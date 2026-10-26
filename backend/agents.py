import logging
import json
from typing import List, Dict, Any, Optional, Literal, TypedDict
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal, QueryAnalytics
from ingestion import ingestion_engine
from reranker import reranker_engine

logger = logging.getLogger("agents")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# 1. Pydantic Output Schemas
# ==============================================================================

class ContextualizedQuery(BaseModel):
    """Schema for Memory Resolution Agent output."""
    standalone_query: str = Field(
        ...,
        description="The resolved, self-contained search query with all pronouns ('it', 'that', 'they') replaced by actual context."
    )
    has_coreference: bool = Field(
        default=False,
        description="Whether the query contained references to previous turns."
    )


class QueryRoute(BaseModel):
    """Schema for Query Understanding Agent output."""
    query_type: Literal["factual", "procedural", "comparative", "ambiguous"] = Field(
        ...,
        description="Classification of user intent: factual, procedural, comparative, or ambiguous."
    )
    is_ambiguous: bool = Field(
        ...,
        description="True if query lacks essential context or has multiple conflicting interpretations."
    )
    reasoning: str = Field(
        ...,
        description="Brief explanation of the classification decision."
    )


class ClarificationOutput(BaseModel):
    """Schema for Clarification Agent output."""
    clarifying_question: str = Field(
        ...,
        description="A targeted, polite clarifying question to disambiguate the user's intent."
    )
    options: List[str] = Field(
        default_factory=list,
        description="2-4 helpful multiple-choice options or paths the user can pick."
    )


class CitationItem(BaseModel):
    """Source attribution detail."""
    document_name: str
    page_number: int
    chunk_index: int
    quote: Optional[str] = None


class GroundedResponse(BaseModel):
    """Schema for Response Generation Agent output."""
    answer: str = Field(
        ...,
        description="Comprehensive grounded response synthesizing accurate information strictly from retrieved chunks."
    )
    citations: List[CitationItem] = Field(
        default_factory=list,
        description="Attributed source documents and page numbers cited in the answer."
    )
    has_sufficient_context: bool = Field(
        default=True,
        description="True if retrieved chunks provided sufficient factual context to answer."
    )


# ==============================================================================
# 2. LangGraph State Schema (TypedDict)
# ==============================================================================

class AgentState(TypedDict):
    session_id: str
    raw_query: str
    chat_history: List[Dict[str, str]]
    standalone_query: str
    query_type: Literal["factual", "procedural", "comparative", "ambiguous"]
    is_ambiguous: bool
    clarification_prompt: Optional[str]
    retrieved_chunks: List[Dict[str, Any]]
    reranked_chunks: List[Dict[str, Any]]
    generated_answer: str
    citations: List[Dict[str, Any]]
    confidence_score: float
    is_knowledge_gap: bool
    domain_filter: Optional[str]


# ==============================================================================
# 3. LLM Factory (Groq Cloud Free Tier + Gemini Free Tier + Zero-Cost Mock Fallback)
# ==============================================================================

def get_llm(model_name: str, temperature: float = 0.0):
    """Factory creating Groq LLM, Google AI Studio LLM, or local deterministic fallback."""
    if settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip() and not settings.GROQ_API_KEY.startswith("gsk_your_"):
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(
                model=model_name,
                groq_api_key=settings.GROQ_API_KEY,
                temperature=temperature,
            )
        except Exception as e:
            logger.warning(f"Groq initialization failed: {e}. Checking Google AI Studio fallback.")

    if settings.GOOGLE_API_KEY and settings.GOOGLE_API_KEY.strip() and not settings.GOOGLE_API_KEY.startswith("your_"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=settings.GOOGLE_FALLBACK_MODEL,
                google_api_key=settings.GOOGLE_API_KEY,
                temperature=temperature,
            )
        except Exception as e:
            logger.warning(f"Google GenAI initialization failed: {e}")

    # Zero-Cost Local Heuristic Mode (Allows instant testing with $0.00 and zero API keys)
    return None


# ==============================================================================
# 4. Agent Nodes
# ==============================================================================

def conversation_memory_node(state: AgentState) -> Dict[str, Any]:
    """Agent 1: Conversation Memory Agent (llama-3.1-8b-instant, temp 0.0)

    Resolves multi-turn conversational coreferences ('what is it?', 'how much?').
    """
    raw_query = state.get("raw_query", "").strip()
    history = state.get("chat_history", [])

    if not history:
        return {"standalone_query": raw_query}

    # Format history transcript
    history_lines = []
    for msg in history[-6:]:  # last 3 turns
        role = msg.get("role", "user").capitalize()
        content = msg.get("content", "")
        history_lines.append(f"{role}: {content}")
    history_str = "\n".join(history_lines)

    llm = get_llm(settings.GROQ_MEMORY_MODEL, temperature=0.0)
    if llm:
        try:
            prompt = (
                "You are an expert Conversation Memory Agent. Given the chat history and the current user query, "
                "resolve all pronouns, references, and implicit topics into a clear, standalone search query.\n"
                "If the query is already independent and complete, return it unchanged.\n\n"
                f"Chat History:\n{history_str}\n\n"
                f"Current User Query: {raw_query}\n\n"
                "Provide output in strict JSON format: {\"standalone_query\": string, \"has_coreference\": bool}"
            )
            resp = llm.invoke([HumanMessage(content=prompt)])
            text = resp.content.strip()
            # Clean possible markdown fence
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            data = json.loads(text)
            resolved = data.get("standalone_query", raw_query)
            return {"standalone_query": resolved}
        except Exception as e:
            logger.warning(f"LLM coreference resolution failed: {e}. Using rule-based fallback.")

    # Local Rule-based / Heuristic Fallback
    resolved_query = raw_query
    lower_query = raw_query.lower()
    pronouns = [" it ", " that ", " this ", " they ", " them ", " its "]
    needs_resolution = any(p in f" {lower_query} " for p in pronouns) or len(raw_query.split()) < 4

    if needs_resolution and history:
        # Extract last subject from assistant or user
        last_turn = history[-1].get("content", "")
        # Add context from the previous turn
        first_clause = last_turn.split(".")[0].split("\n")[0][:80].strip()
        resolved_query = f"{raw_query} (context: {first_clause})"

    return {"standalone_query": resolved_query}


def query_understanding_node(state: AgentState) -> Dict[str, Any]:
    """Agent 2: Query Understanding Agent (llama-3.1-8b-instant, temp 0.0)

    Classifies intent: factual, procedural, comparative, or ambiguous.
    """
    query = state.get("standalone_query") or state.get("raw_query", "")
    query_clean = query.strip()

    llm = get_llm(settings.GROQ_UNDERSTANDING_MODEL, temperature=0.0)
    if llm:
        try:
            prompt = (
                "You are a Query Understanding Agent. Classify the user's query into exactly one category:\n"
                "- 'factual': Specific facts, definitions, policies, dates, numbers.\n"
                "- 'procedural': How-to guides, step-by-step processes, workflows, guidelines.\n"
                "- 'comparative': Comparing options, differences, pros/cons, evaluations.\n"
                "- 'ambiguous': Vague, missing crucial details, single disconnected keywords, or underspecified.\n\n"
                f"Query: \"{query_clean}\"\n\n"
                "Return strict JSON: {\"query_type\": \"factual\"|\"procedural\"|\"comparative\"|\"ambiguous\", "
                "\"is_ambiguous\": bool, \"reasoning\": string}"
            )
            resp = llm.invoke([HumanMessage(content=prompt)])
            text = resp.content.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            data = json.loads(text)
            q_type = data.get("query_type", "factual")
            is_amb = data.get("is_ambiguous", q_type == "ambiguous")
            return {"query_type": q_type, "is_ambiguous": is_amb}
        except Exception as e:
            logger.warning(f"Query Understanding LLM failed: {e}. Using deterministic classifier.")

    # Deterministic Rule-based Intent Classifier
    lower = query_clean.lower()
    words = lower.split()

    if len(words) <= 1 or lower in ["help", "info", "tell me", "what", "how", "process", "details"]:
        return {"query_type": "ambiguous", "is_ambiguous": True}

    if any(k in lower for k in ["difference", "compare", "versus", "vs", "better", "pros and cons", "instead of"]):
        return {"query_type": "comparative", "is_ambiguous": False}

    if any(k in lower for k in ["how to", "steps", "procedure", "process", "guide", "how do i", "instructions"]):
        return {"query_type": "procedural", "is_ambiguous": False}

    return {"query_type": "factual", "is_ambiguous": False}


def clarification_node(state: AgentState) -> Dict[str, Any]:
    """Agent 3: Clarification Agent (llama-3.3-70b-versatile, temp 0.3)

    Formulates targeted clarifying questions for ambiguous inputs.
    """
    raw_query = state.get("raw_query", "")
    llm = get_llm(settings.GROQ_CLARIFICATION_MODEL, temperature=0.3)

    clarification_text = (
        f"Your query '{raw_query}' is a bit broad or missing specific details. "
        "Could you please specify which domain or topic you're inquiring about? "
        "(e.g., Company HR Policies, Student Handbook Guidelines, or Technical API Documentation)"
    )

    if llm:
        try:
            prompt = (
                "You are a helpful Clarification Agent in an Intelligent Query Resolution System.\n"
                f"The user entered an ambiguous or incomplete query: \"{raw_query}\".\n"
                "Formulate a polite, concise clarifying question and suggest 2 to 3 specific aspects they might mean.\n"
                "Return strict JSON: {\"clarifying_question\": string, \"options\": [string, string]}"
            )
            resp = llm.invoke([HumanMessage(content=prompt)])
            text = resp.content.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            data = json.loads(text)
            question = data.get("clarifying_question", clarification_text)
            options = data.get("options", [])
            if options:
                opt_str = "\n".join([f"• {opt}" for opt in options])
                clarification_text = f"{question}\n\nSuggested topics:\n{opt_str}"
            else:
                clarification_text = question
        except Exception as e:
            logger.warning(f"Clarification LLM failed: {e}")

    return {
        "generated_answer": clarification_text,
        "confidence_score": 0.50,
        "reranked_chunks": [],
        "retrieved_chunks": [],
        "citations": [],
        "is_knowledge_gap": False,
    }


def retrieval_rerank_node(state: AgentState) -> Dict[str, Any]:
    """Agent 4: Retrieval & Reranking Agent

    Queries Qdrant for Top-15 candidate chunks, reranks using FlashRank,
    calculates Sigmoid confidence score C = 1 / (1 + exp(-z)), and filters < 0.40.
    """
    query = state.get("standalone_query") or state.get("raw_query", "")
    domain = state.get("domain_filter")

    # Step A: Top-15 Retrieval from Qdrant
    candidates = ingestion_engine.search_candidates(
        query=query,
        top_k=settings.RETRIEVAL_TOP_K,
        domain_filter=domain,
    )

    # Step B: FlashRank Cross-Encoder Precision Reranking & Sigmoid Calibration
    reranked, best_confidence, is_knowledge_gap = reranker_engine.rerank_chunks(
        query=query,
        chunks=candidates,
        top_k=settings.RERANK_TOP_K,
        threshold=settings.CONFIDENCE_THRESHOLD,
    )

    # Step C: Log Knowledge Gap if all chunks < 0.40
    if is_knowledge_gap:
        logger.info(f"Knowledge Gap Detected for query: '{query}' (Confidence: {best_confidence})")
        try:
            db: Session = SessionLocal()
            gap_entry = QueryAnalytics(
                query_text=query,
                confidence_score=best_confidence,
                is_unanswered=True,
                query_type=state.get("query_type", "factual"),
            )
            db.add(gap_entry)
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Failed to log knowledge gap to DB: {e}")

    return {
        "retrieved_chunks": candidates,
        "reranked_chunks": reranked,
        "confidence_score": best_confidence,
        "is_knowledge_gap": is_knowledge_gap,
    }


def response_generation_node(state: AgentState) -> Dict[str, Any]:
    """Agent 5: Response Generation Agent (llama-3.3-70b-versatile, temp 0.1)

    Synthesizes grounded answers strictly from filtered chunks with inline citations.
    """
    query = state.get("standalone_query") or state.get("raw_query", "")
    chunks = state.get("reranked_chunks", [])
    confidence = state.get("confidence_score", 0.0)
    is_gap = state.get("is_knowledge_gap", False)

    # Handle Knowledge Gap when confidence < 0.40 or no chunks
    if is_gap or not chunks:
        answer = (
            f"I could not find sufficiently verified information in the current knowledge base "
            f"to reliably answer your query (Confidence score: {confidence:.2f} < 0.40 threshold).\n\n"
            "This query has been logged to the **Knowledge Gap Analytics** dashboard for administrative review. "
            "Please consider uploading relevant documents or refining your search parameters."
        )
        return {
            "generated_answer": answer,
            "citations": [],
        }

    # Format retrieved passages with source IDs
    context_blocks = []
    citations = []
    for c in chunks:
        fn = c.get("filename", "Unknown Document")
        pg = c.get("page_number", 1)
        idx = c.get("chunk_index", 0)
        c_text = c.get("chunk_text", "").strip()

        block = f"[Source: {fn} | Page: {pg} | Chunk: #{idx}]\n{c_text}"
        context_blocks.append(block)

        citations.append(
            {
                "document_name": fn,
                "page_number": pg,
                "chunk_index": idx,
                "confidence_score": c.get("confidence_score", confidence),
            }
        )

    context_str = "\n\n---\n\n".join(context_blocks)

    llm = get_llm(settings.GROQ_GENERATION_MODEL, temperature=0.1)
    if llm:
        try:
            prompt = (
                "You are an expert, highly accurate Response Generation Agent in an Intelligent Query Resolution System.\n"
                "Answer the user query strictly and solely based on the provided context passages below.\n"
                "Rules:\n"
                "1. Cite sources inline using the format [DocumentName, p.X, Chunk#Y].\n"
                "2. Maintain an authoritative, professional, and clear tone.\n"
                "3. If the context does not fully answer the question, state what is known and clarify what is missing.\n"
                "4. Do NOT hallucinate facts not present in the passages.\n\n"
                f"Context Passages:\n{context_str}\n\n"
                f"User Query: {query}\n\n"
                "Provide a complete, well-structured grounded response."
            )
            resp = llm.invoke([HumanMessage(content=prompt)])
            answer = resp.content.strip()
            return {
                "generated_answer": answer,
                "citations": citations,
            }
        except Exception as e:
            logger.warning(f"Response Generation LLM failed: {e}. Using grounded passage synthesis.")

    # High-quality Grounded Deterministic Fallback Synthesis
    best_chunk = chunks[0]
    lead_source = f"[{best_chunk['filename']}, p.{best_chunk['page_number']}, Chunk#{best_chunk['chunk_index']}]"

    synth_body = best_chunk['chunk_text']
    extra_context = ""
    if len(chunks) > 1:
        extra_chunk = chunks[1]
        extra_source = f"[{extra_chunk['filename']}, p.{extra_chunk['page_number']}, Chunk#{extra_chunk['chunk_index']}]"
        extra_context = f"\n\n**Additional Details** {extra_source}:\n{extra_chunk['chunk_text']}"

    grounded_answer = (
        f"Based on verified knowledge base documentation {lead_source}:\n\n"
        f"{synth_body}"
        f"{extra_context}"
    )

    return {
        "generated_answer": grounded_answer,
        "citations": citations,
    }


# ==============================================================================
# 5. Routing Condition
# ==============================================================================

def route_understanding_decision(state: AgentState) -> str:
    """Conditional Edge: routes to clarification if ambiguous, else to retrieval."""
    if state.get("is_ambiguous", False):
        return "clarification_node"
    return "retrieval_rerank_node"


# ==============================================================================
# 6. LangGraph State Machine Construction
# ==============================================================================

def build_query_resolution_graph() -> StateGraph:
    """Constructs the 5-Agent cyclic/directed LangGraph state machine."""
    workflow = StateGraph(AgentState)

    # Register Nodes
    workflow.add_node("conversation_memory_node", conversation_memory_node)
    workflow.add_node("query_understanding_node", query_understanding_node)
    workflow.add_node("clarification_node", clarification_node)
    workflow.add_node("retrieval_rerank_node", retrieval_rerank_node)
    workflow.add_node("response_generation_node", response_generation_node)

    # Set Entry Point
    workflow.set_entry_point("conversation_memory_node")

    # Transitions
    workflow.add_edge("conversation_memory_node", "query_understanding_node")

    # Conditional Routing Edge
    workflow.add_conditional_edges(
        "query_understanding_node",
        route_understanding_decision,
        {
            "clarification_node": "clarification_node",
            "retrieval_rerank_node": "retrieval_rerank_node",
        },
    )

    workflow.add_edge("clarification_node", END)
    workflow.add_edge("retrieval_rerank_node", "response_generation_node")
    workflow.add_edge("response_generation_node", END)

    return workflow.compile()


# Global compiled graph
query_resolution_graph = build_query_resolution_graph()
