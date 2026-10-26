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


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    domain_category = Column(String(100), default="General")
    chunk_count = Column(Integer, default=0)
    upload_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


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


def init_db():
    global engine, SessionLocal
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        import logging
        logging.getLogger("database").error(f"init_db failed on primary engine ({e}). Falling back to SQLite.")
        fallback_path = Path(__file__).resolve().parent / "query_system.db"
        engine = create_engine(f"sqlite:///{fallback_path}", connect_args={"check_same_thread": False})
        SessionLocal.configure(bind=engine)
        Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
