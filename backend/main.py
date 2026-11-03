"""
main.py — FastAPI Application Entry Point
==========================================
Exposes REST endpoints for the AI-Powered Intelligent Query Resolution System.

Authentication model:
  - POST /api/register  (public) — creates a new user account
  - POST /api/login     (public) — returns a signed JWT access token
  - All other /api/* endpoints require a valid Bearer token extracted via
    the `get_current_user` dependency, which scopes data to the caller's
    user_id for full multi-tenant isolation.

Public (no auth): GET /, GET /api/health, GET /api/chat/history/{id},
                  POST /api/seed-samples
"""

import os
import shutil
import uuid
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from config import settings
from database import init_db, get_db, Document, Chunk, ChatSession, ChatMessage, QueryAnalytics, User
from ingestion import ingestion_engine
from agents import query_resolution_graph
from security import hash_password, verify_password, create_access_token, decode_access_token

logger = logging.getLogger("main")
logging.basicConfig(level=logging.INFO)


# Ensure database tables are created on module import (pre-lifespan safety net)
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialise DB on startup, clean up on shutdown."""
    logger.info("Initializing relational database schema...")
    init_db()
    temp_dir = Path(__file__).resolve().parent / "uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    yield
    logger.info("Application shutdown.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Domain-agnostic voice and text conversational query resolution system with LangGraph and Qdrant.",
    lifespan=lifespan,
)

# CORS — allow all origins so Vercel frontend can reach Render backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler that guarantees CORS headers are always returned on 500 errors."""
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

# ==============================================================================
# OAuth2 Bearer Scheme & Auth Dependency
# ==============================================================================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — validates the Bearer JWT and returns the User ORM row.
    Raises HTTP 401 for missing, expired, or invalid tokens.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise ValueError("Token payload missing 'sub' claim.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is inactive.",
        )
    return user


# ==============================================================================
# Pydantic Request & Response Models
# ==============================================================================

class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address (used as login identifier).")
    password: str = Field(..., min_length=6, description="Plain-text password (min 6 chars).")
    full_name: Optional[str] = Field(None, description="Optional display name.")


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str] = None


class QueryRequest(BaseModel):
    query: str = Field(..., description="The user's natural language or transcribed voice query.")
    session_id: Optional[str] = Field(None, description="Unique conversation session UUID.")
    domain_filter: Optional[str] = Field("All", description="Optional domain constraint (e.g., HR, Academic, Tech).")
    # user_id is now derived from the JWT token; kept for backward compat but overridden server-side
    user_id: Optional[str] = Field(None, description="Deprecated — user identity is derived from JWT.")


class QueryResponse(BaseModel):
    session_id: str
    raw_query: str
    standalone_query: str
    query_type: str
    is_ambiguous: bool
    generated_answer: str
    confidence_score: float
    citations: List[Dict[str, Any]]
    reranked_chunks: List[Dict[str, Any]]
    is_knowledge_gap: bool


class DocumentItem(BaseModel):
    id: str
    filename: str
    file_type: str
    domain_category: str
    chunk_count: int
    upload_timestamp: str


class AnalyticsSummary(BaseModel):
    total_queries: int
    unanswered_count: int
    low_confidence_count: int
    average_confidence: float
    recent_knowledge_gaps: List[Dict[str, Any]]


# ==============================================================================
# Public Endpoints (no auth required)
# ==============================================================================

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Health check for all subcomponents."""
    db_ok = True
    try:
        db.execute(func.now()).all()
    except Exception:
        db_ok = False

    qdrant_ok = True
    try:
        ingestion_engine.qdrant_client.get_collection(ingestion_engine.collection_name)
    except Exception:
        qdrant_ok = False

    return {
        "status": "healthy" if db_ok and qdrant_ok else "degraded",
        "database": "connected" if db_ok else "error",
        "qdrant": "connected" if qdrant_ok else "error",
        "fastembed_model": settings.FASTEMBED_MODEL_NAME,
        "flashrank_model": settings.FLASHRANK_MODEL_NAME,
        "groq_configured": bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_your_")),
        "google_configured": bool(settings.GOOGLE_API_KEY and not settings.GOOGLE_API_KEY.startswith("your_")),
    }


@app.get("/api/chat/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Retrieves conversation history for a given session (public for backward compat)."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "query_type": m.query_type,
            "confidence_score": m.confidence_score,
            "citations": m.citations or [],
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


# ==============================================================================
# Authentication Endpoints (public — issue / validate tokens)
# ==============================================================================

@app.post("/api/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Creates a new user account.
    Returns a JWT so the user is immediately logged in after registration.
    """
    email_lower = request.email.strip().lower()

    # Prevent duplicate accounts
    existing = db.query(User).filter(User.email == email_lower).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    new_user = User(
        email=email_lower,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.id, "email": new_user.email})
    logger.info(f"New user registered: {email_lower}")
    return TokenResponse(
        access_token=token,
        user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
    )


@app.post("/api/login", response_model=TokenResponse)
def login_user(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns a signed JWT access token.
    Token lifetime: JWT_ACCESS_TOKEN_EXPIRE_MINUTES (default 480 min / 8 hrs).
    """
    email_lower = request.email.strip().lower()
    user = db.query(User).filter(User.email == email_lower, User.is_active == True).first()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.id, "email": user.email})
    logger.info(f"User logged in: {email_lower}")
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


# ==============================================================================
# Protected Endpoints (require valid Bearer JWT)
# ==============================================================================

@app.post("/api/upload", response_model=DocumentItem)
async def upload_document(
    file: UploadFile = File(...),
    domain_category: str = Form("General"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Handles multi-format document uploads (PDF, DOCX, TXT, CSV), chunking, and vector indexing.
    Documents are scoped to the authenticated user."""
    filename = file.filename or "uploaded_document"
    ext = Path(filename).suffix.lower()
    allowed_exts = [".pdf", ".docx", ".doc", ".txt", ".md", ".csv"]

    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(allowed_exts)}",
        )

    upload_dir = Path(__file__).resolve().parent / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    temp_file_path = upload_dir / f"{uuid.uuid4()}_{filename}"

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Ingest into Qdrant & PostgreSQL/SQLite
        doc_record = ingestion_engine.chunk_and_index_document(
            file_path=str(temp_file_path),
            filename=filename,
            domain_category=domain_category,
            db_session=db,
            user_id=current_user.id,
        )

        return DocumentItem(
            id=doc_record.id,
            filename=doc_record.filename,
            file_type=doc_record.file_type,
            domain_category=doc_record.domain_category,
            chunk_count=doc_record.chunk_count,
            upload_timestamp=doc_record.upload_timestamp.isoformat(),
        )
    except Exception as e:
        logger.error(f"Upload and indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception:
                pass


@app.post("/api/query", response_model=QueryResponse)
async def process_query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Processes user queries through the 5-Agent LangGraph orchestration state machine.
    Vector retrieval is scoped to the authenticated user's documents."""
    query_text = request.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Always use the authenticated user's ID — ignore any client-supplied user_id
    user_id = current_user.id
    session_id = request.session_id or str(uuid.uuid4())

    # Retrieve or create session in DB
    chat_session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not chat_session:
        chat_session = ChatSession(id=session_id, user_id=user_id)
        db.add(chat_session)
        db.commit()

    # Fetch last 10 turns of chat history for coreference resolution
    past_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
        .all()
    )
    chat_history_list = [{"role": m.role, "content": m.content} for m in past_messages]

    # Save incoming user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=query_text)
    db.add(user_msg)
    db.commit()

    # Fetch active document filenames for query contextualization (strictly scoped to this user)
    user_doc_records = (
        db.query(Document.filename)
        .filter(Document.user_id == user_id)
        .all()
    )
    user_doc_names = [d[0] for d in user_doc_records]

    # Prepare LangGraph state — include user_id for scoped Qdrant retrieval
    initial_state = {
        "session_id": session_id,
        "raw_query": query_text,
        "chat_history": chat_history_list,
        "standalone_query": query_text,
        "query_type": "factual",
        "is_ambiguous": False,
        "clarification_prompt": None,
        "retrieved_chunks": [],
        "reranked_chunks": [],
        "generated_answer": "",
        "citations": [],
        "confidence_score": 0.0,
        "is_knowledge_gap": False,
        "domain_filter": None if request.domain_filter == "All" else request.domain_filter,
        "user_id": user_id,
        "user_name": current_user.full_name or "User",
        "user_documents": user_doc_names,
    }

    try:
        result_state = query_resolution_graph.invoke(initial_state)

        # Persist assistant response
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=result_state["generated_answer"],
            query_type=result_state["query_type"],
            confidence_score=result_state["confidence_score"],
            citations=result_state["citations"],
        )
        db.add(assistant_msg)

        # Log to analytics (scoped to user)
        analytics_entry = QueryAnalytics(
            query_text=query_text,
            confidence_score=result_state["confidence_score"],
            is_unanswered=result_state["is_knowledge_gap"],
            query_type=result_state["query_type"],
            user_id=user_id,
        )
        db.add(analytics_entry)
        db.commit()

        return QueryResponse(
            session_id=session_id,
            raw_query=result_state["raw_query"],
            standalone_query=result_state.get("standalone_query", query_text),
            query_type=result_state.get("query_type", "factual"),
            is_ambiguous=result_state.get("is_ambiguous", False),
            generated_answer=result_state.get("generated_answer", ""),
            confidence_score=result_state.get("confidence_score", 0.0),
            citations=result_state.get("citations", []),
            reranked_chunks=result_state.get("reranked_chunks", []),
            is_knowledge_gap=result_state.get("is_knowledge_gap", False),
        )
    except Exception as e:
        logger.error(f"Error during agent execution: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Agent workflow error: {str(e)}")


@app.get("/api/documents", response_model=List[DocumentItem])
def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves documents belonging to the authenticated user."""
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(desc(Document.upload_timestamp))
        .all()
    )
    return [
        DocumentItem(
            id=d.id,
            filename=d.filename,
            file_type=d.file_type,
            domain_category=d.domain_category,
            chunk_count=d.chunk_count,
            upload_timestamp=d.upload_timestamp.isoformat(),
        )
        for d in docs
    ]


@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes a document and its indexed vectors. Only the owner can delete."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.user_id and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this document.")

    success = ingestion_engine.delete_document(document_id, db)
    if not success:
        raise HTTPException(status_code=500, detail="Could not delete document vectors.")
    return {"status": "success", "message": f"Document {document_id} deleted."}


@app.get("/api/analytics", response_model=AnalyticsSummary)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns knowledge gap analytics scoped to the authenticated user."""
    base_q = db.query(QueryAnalytics).filter(QueryAnalytics.user_id == current_user.id)
    total = base_q.count()
    unanswered = base_q.filter(QueryAnalytics.is_unanswered == True).count()
    low_conf = base_q.filter(QueryAnalytics.confidence_score < settings.CONFIDENCE_THRESHOLD).count()
    avg_conf = db.query(func.avg(QueryAnalytics.confidence_score)).filter(
        QueryAnalytics.user_id == current_user.id
    ).scalar() or 0.0

    gaps = (
        base_q.filter(QueryAnalytics.confidence_score < settings.CONFIDENCE_THRESHOLD)
        .order_by(desc(QueryAnalytics.created_at))
        .limit(25)
        .all()
    )
    gap_list = [
        {
            "id": g.id,
            "query_text": g.query_text,
            "confidence_score": round(g.confidence_score, 4),
            "is_unanswered": g.is_unanswered,
            "query_type": g.query_type or "unknown",
            "created_at": g.created_at.isoformat(),
        }
        for g in gaps
    ]

    return AnalyticsSummary(
        total_queries=total,
        unanswered_count=unanswered,
        low_confidence_count=low_conf,
        average_confidence=round(float(avg_conf), 4),
        recent_knowledge_gaps=gap_list,
    )


@app.delete("/api/analytics/{gap_id}")
def delete_analytics_entry(
    gap_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes a single knowledge gap report. Only the owner can delete."""
    entry = db.query(QueryAnalytics).filter(QueryAnalytics.id == gap_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Analytics record not found.")
    if entry.user_id and entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied.")
    db.delete(entry)
    db.commit()
    return {"status": "success", "message": f"Analytics record {gap_id} deleted."}


@app.delete("/api/analytics")
def clear_all_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clears all knowledge gap analytics reports for the authenticated user."""
    deleted_count = (
        db.query(QueryAnalytics)
        .filter(QueryAnalytics.user_id == current_user.id)
        .delete()
    )
    db.commit()
    return {"status": "success", "deleted_count": deleted_count, "message": "All analytics reports cleared."}


@app.post("/api/seed-samples")
def seed_sample_data(
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One-click seeding of multi-domain knowledge bases (HR, Academic, FAQ CSV).
    Samples are seeded as owned by the authenticated user."""
    sample_dir = Path(__file__).resolve().parent / "sample_data"
    seeded_docs = []

    samples = [
        ("hr_policy.txt", "Human Resources"),
        ("student_handbook.txt", "Academic Regulations"),
        ("faq_knowledge.csv", "System FAQs"),
    ]

    for fname, domain in samples:
        fpath = sample_dir / fname
        if fpath.exists():
            existing = (
                db.query(Document)
                .filter(Document.filename == fname, Document.user_id == current_user.id)
                .first()
            )
            if existing and force:
                db.delete(existing)
                db.commit()
                existing = None

            if not existing:
                doc = ingestion_engine.chunk_and_index_document(
                    file_path=str(fpath),
                    filename=fname,
                    domain_category=domain,
                    db_session=db,
                    user_id=current_user.id,
                )
                seeded_docs.append({"filename": fname, "domain": domain, "chunks": doc.chunk_count})
            else:
                seeded_docs.append({"filename": fname, "status": "already_indexed"})

    return {"status": "success", "seeded_documents": seeded_docs}
