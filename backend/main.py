import os
import shutil
import uuid
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from config import settings
from database import init_db, get_db, Document, Chunk, ChatSession, ChatMessage, QueryAnalytics
from ingestion import ingestion_engine
from agents import query_resolution_graph

logger = logging.getLogger("main")
logging.basicConfig(level=logging.INFO)


# Ensure database tables are created on module import
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database Tables
    logger.info("Initializing relational database schema...")
    init_db()
    # Ensure upload temp directory exists
    temp_dir = Path(__file__).resolve().parent / "uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown logic
    logger.info("Application shutdown.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Domain-agnostic voice and text conversational query resolution system with LangGraph and Qdrant ($0.00 cost stack).",
    lifespan=lifespan,
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# Pydantic Request & Response Models
# ==============================================================================

class QueryRequest(BaseModel):
    query: str = Field(..., description="The user's natural language or transcribed voice query.")
    session_id: Optional[str] = Field(None, description="Unique conversation session UUID.")
    domain_filter: Optional[str] = Field("All", description="Optional domain constraint (e.g., HR, Academic, Tech).")
    user_id: Optional[str] = Field("guest_user", description="Identifier for the user.")


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
# Endpoints
# ==============================================================================

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "budget": "$0.00 (Zero paid APIs required)",
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Health check for all subcomponents."""
    # Check DB
    db_ok = True
    try:
        db.execute(func.now()).all()
    except Exception:
        db_ok = False

    # Check Qdrant
    qdrant_ok = True
    collection_info = None
    try:
        collection_info = ingestion_engine.qdrant_client.get_collection(ingestion_engine.collection_name)
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


@app.post("/api/upload", response_model=DocumentItem)
async def upload_document(
    file: UploadFile = File(...),
    domain_category: str = Form("General"),
    db: Session = Depends(get_db),
):
    """Handles multi-format document uploads (PDF, DOCX, TXT, CSV), chunking and vector indexing."""
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

        # Ingest into Qdrant & SQLite/Postgres
        doc_record = ingestion_engine.chunk_and_index_document(
            file_path=str(temp_file_path),
            filename=filename,
            domain_category=domain_category,
            db_session=db,
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
        # Clean up temp file
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception:
                pass


@app.post("/api/query", response_model=QueryResponse)
async def process_query(
    request: QueryRequest,
    db: Session = Depends(get_db),
):
    """Processes user queries through the 5-Agent LangGraph orchestration state machine."""
    query_text = request.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    session_id = request.session_id or str(uuid.uuid4())

    # Retrieve or create session in DB
    chat_session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not chat_session:
        chat_session = ChatSession(id=session_id, user_id=request.user_id)
        db.add(chat_session)
        db.commit()

    # Fetch last turns of chat history for coreference resolution
    past_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
        .all()
    )
    chat_history_list = [{"role": m.role, "content": m.content} for m in past_messages]

    # Save incoming user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=query_text,
    )
    db.add(user_msg)
    db.commit()

    # Prepare LangGraph state
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
    }

    try:
        # Run LangGraph pipeline
        result_state = query_resolution_graph.invoke(initial_state)

        # Record assistant answer to DB
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=result_state["generated_answer"],
            query_type=result_state["query_type"],
            confidence_score=result_state["confidence_score"],
            citations=result_state["citations"],
        )
        db.add(assistant_msg)

        # Log query to analytics table
        analytics_entry = QueryAnalytics(
            query_text=query_text,
            confidence_score=result_state["confidence_score"],
            is_unanswered=result_state["is_knowledge_gap"],
            query_type=result_state["query_type"],
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
def get_documents(db: Session = Depends(get_db)):
    """Retrieves all indexed documents."""
    docs = db.query(Document).order_by(desc(Document.upload_timestamp)).all()
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
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Deletes a document and its indexed vectors."""
    success = ingestion_engine.delete_document(document_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or could not be deleted.")
    return {"status": "success", "message": f"Document {document_id} deleted."}


@app.get("/api/analytics", response_model=AnalyticsSummary)
def get_analytics(db: Session = Depends(get_db)):
    """Returns knowledge gap analytics, low-confidence queries (<0.40), and summary metrics."""
    total = db.query(QueryAnalytics).count()
    unanswered = db.query(QueryAnalytics).filter(QueryAnalytics.is_unanswered == True).count()
    low_conf = db.query(QueryAnalytics).filter(QueryAnalytics.confidence_score < settings.CONFIDENCE_THRESHOLD).count()

    avg_conf = db.query(func.avg(QueryAnalytics.confidence_score)).scalar() or 0.0

    gaps = (
        db.query(QueryAnalytics)
        .filter(QueryAnalytics.confidence_score < settings.CONFIDENCE_THRESHOLD)
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


@app.get("/api/chat/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Retrieves conversation history for a given session."""
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


@app.post("/api/seed-samples")
def seed_sample_data(force: bool = False, db: Session = Depends(get_db)):
    """One-click seeding of multi-domain knowledge bases (HR, Academic, FAQ CSV)."""
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
            existing = db.query(Document).filter(Document.filename == fname).first()
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
                )
                seeded_docs.append({"filename": fname, "domain": domain, "chunks": doc.chunk_count})
            else:
                seeded_docs.append({"filename": fname, "status": "already_indexed"})

    return {"status": "success", "seeded_documents": seeded_docs}
