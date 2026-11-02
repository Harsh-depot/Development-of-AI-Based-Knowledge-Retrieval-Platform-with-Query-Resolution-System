import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import settings

# ---------------------------------------------------------------------------
# NOTE ON MIGRATION STRATEGY
# ---------------------------------------------------------------------------
# All new FK columns (user_id on Document, QueryAnalytics, ChatSession) are
# nullable=True so that existing rows created before auth was added remain
# valid.  SQLAlchemy's create_all() will create new tables (e.g. "users") but
# will NOT add new columns to existing tables in SQLite.  For Render/Supabase
# (Postgres) the same applies.  The init_db() function issues ALTER TABLE
# statements guarded by try/except to handle the case where columns already
# exist or the DB engine does not support transactional DDL.

# Engine setup with intelligent fallback
db_url = settings.DATABASE_URL
connect_args = {}

from pathlib import Path
fallback_sqlite_path = Path(__file__).resolve().parent / "query_system.db"
fallback_sqlite_url = f"sqlite:///{fallback_sqlite_path}"

if not db_url or db_url.startswith("http://") or db_url.startswith("https://"):
    db_url = fallback_sqlite_url
    connect_args = {"check_same_thread": False}
elif db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(db_url, connect_args=connect_args)
    # Test connection if not SQLite
    if not db_url.startswith("sqlite"):
        with engine.connect() as test_conn:
            pass
except Exception as e:
    import logging
    logging.getLogger("database").warning(
        f"Could not connect to external DATABASE_URL ({e}). Render instances may lack IPv6 connectivity. Falling back to local SQLite at {fallback_sqlite_path}"
    )
    db_url = fallback_sqlite_url
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """Registered application user for multi-tenant data isolation."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    # Relationships (back-references for ownership)
    documents = relationship("Document", back_populates="owner")
    analytics = relationship("QueryAnalytics", back_populates="owner")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    domain_category = Column(String(100), default="General")
    chunk_count = Column(Integer, default=0)
    upload_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Multi-tenant ownership — nullable for backward compat with pre-auth documents
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    owner = relationship("User", back_populates="documents")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    page_number = Column(Integer, default=1)

    document = relationship("Document", back_populates="chunks")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(100), default="guest_user")
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    session_metadata = Column(JSON, default=dict)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    query_type = Column(String(50), nullable=True)
    confidence_score = Column(Float, nullable=True)
    citations = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")


class QueryAnalytics(Base):
    __tablename__ = "query_analytics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    query_text = Column(Text, nullable=False)
    confidence_score = Column(Float, default=0.0)
    is_unanswered = Column(Boolean, default=False)
    query_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Multi-tenant ownership — nullable for backward compat
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    owner = relationship("User", back_populates="analytics")


def _run_migrations(bind_engine) -> None:
    """
    Attempt to add new nullable columns to existing tables via raw SQL.
    Uses try/except per statement so that already-applied migrations are silently skipped.
    This handles the case where SQLAlchemy's create_all() cannot ALTER existing tables.
    """
    import logging
    _log = logging.getLogger("database.migration")
    is_sqlite = str(bind_engine.url).startswith("sqlite")

    migration_stmts = [
        # documents — add user_id FK column
        "ALTER TABLE documents ADD COLUMN user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL",
        # query_analytics — add user_id FK column
        "ALTER TABLE query_analytics ADD COLUMN user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL",
    ]
    # SQLite uses a simplified FK syntax (no inline REFERENCES in ALTER TABLE)
    if is_sqlite:
        migration_stmts = [
            "ALTER TABLE documents ADD COLUMN user_id VARCHAR(36)",
            "ALTER TABLE query_analytics ADD COLUMN user_id VARCHAR(36)",
        ]

    with bind_engine.connect() as conn:
        for stmt in migration_stmts:
            try:
                conn.execute(stmt if hasattr(stmt, "text") else __import__("sqlalchemy").text(stmt))
                conn.commit()
                _log.info(f"Migration applied: {stmt[:60]}...")
            except Exception as exc:
                # Column already exists — safe to ignore
                _log.debug(f"Migration skipped (likely already applied): {exc}")


def init_db():
    global engine, SessionLocal
    try:
        Base.metadata.create_all(bind=engine)
        # Attempt column-level migrations for tables that pre-date auth
        _run_migrations(engine)
    except Exception as e:
        import logging
        logging.getLogger("database").error(f"init_db failed on primary engine ({e}). Falling back to SQLite.")
        fallback_path = Path(__file__).resolve().parent / "query_system.db"
        engine = create_engine(f"sqlite:///{fallback_path}", connect_args={"check_same_thread": False})
        SessionLocal.configure(bind=engine)
        Base.metadata.create_all(bind=engine)
        _run_migrations(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
