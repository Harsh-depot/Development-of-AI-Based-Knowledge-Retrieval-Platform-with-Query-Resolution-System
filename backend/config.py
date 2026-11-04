import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env if present
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseModel):
    # App Settings
    PROJECT_NAME: str = "AI-Powered Intelligent Query Resolution System"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # LLM Providers (Free Tier)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    
    # Models
    GROQ_MEMORY_MODEL: str = os.getenv("GROQ_MEMORY_MODEL", "qwen/qwen3.8-27b")
    GROQ_UNDERSTANDING_MODEL: str = os.getenv("GROQ_UNDERSTANDING_MODEL", "qwen/qwen3.8-27b")
    GROQ_CLARIFICATION_MODEL: str = os.getenv("GROQ_CLARIFICATION_MODEL", "qwen/qwen3.8-27b")
    GROQ_GENERATION_MODEL: str = os.getenv("GROQ_GENERATION_MODEL", "qwen/qwen3.8-27b")
    GOOGLE_FALLBACK_MODEL: str = os.getenv("GOOGLE_FALLBACK_MODEL", "gemini-2.0-flash")

    # Qdrant Vector Store (Free Tier Cloud or Local disk/memory)
    QDRANT_URL: str = os.getenv("QDRANT_URL", "")
    QDRANT_API_KEY: str = os.getenv("QDRANT_API_KEY", "")
    QDRANT_COLLECTION_NAME: str = os.getenv("QDRANT_COLLECTION_NAME", "knowledge_base")
    LOCAL_QDRANT_PATH: str = str(Path(__file__).resolve().parent / "qdrant_data")

    # Local CPU Models ($0.00 Cost)
    FASTEMBED_MODEL_NAME: str = os.getenv("FASTEMBED_MODEL_NAME", "BAAI/bge-small-en-v1.5")
    # FlashRank cross-encoder model for Stage-2 precision reranking (TinyBERT: 20MB RAM, fast CPU inference)
    FLASHRANK_MODEL_NAME: str = os.getenv("FLASHRANK_MODEL_NAME", "ms-marco-TinyBERT-L-2-v2")

    # Relational Database (PostgreSQL Neon/Supabase or Local SQLite fallback)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{Path(__file__).resolve().parent / 'query_system.db'}")

    # JWT Authentication
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-this-to-a-secure-random-secret-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # RAG Tuning Parameters
    RETRIEVAL_TOP_K: int = int(os.getenv("RETRIEVAL_TOP_K", "15"))
    RERANK_TOP_K: int = int(os.getenv("RERANK_TOP_K", "4"))
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.40"))
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "800"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "120"))


settings = Settings()
