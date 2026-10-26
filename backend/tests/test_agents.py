import pytest
from agents import (
    ContextualizedQuery,
    QueryRoute,
    ClarificationOutput,
    GroundedResponse,
    CitationItem,
    query_resolution_graph,
    query_understanding_node,
    conversation_memory_node,
)

def test_pydantic_schemas():
    cq = ContextualizedQuery(standalone_query="What is the leave entitlement?", has_coreference=False)
    assert cq.standalone_query == "What is the leave entitlement?"

    qr = QueryRoute(query_type="factual", is_ambiguous=False, reasoning="Explicit question about policy")
    assert qr.query_type == "factual"
    assert not qr.is_ambiguous

    co = ClarificationOutput(
        clarifying_question="Did you mean annual leave or sick leave?",
        options=["Annual Leave", "Sick Leave"]
    )
    assert len(co.options) == 2

    gr = GroundedResponse(
        answer="Employees are entitled to 24 annual leaves.",
        citations=[CitationItem(document_name="hr_policy.txt", page_number=1, chunk_index=1)],
        has_sufficient_context=True
    )
    assert gr.citations[0].document_name == "hr_policy.txt"


def test_intent_classification():
    # Ambiguous test
    ambiguous_state = {"raw_query": "help", "standalone_query": "help"}
    result_amb = query_understanding_node(ambiguous_state)
    assert result_amb["is_ambiguous"] is True
    assert result_amb["query_type"] == "ambiguous"

    # Procedural test
    procedural_state = {"raw_query": "how to apply for medical leave", "standalone_query": "how to apply for medical leave"}
    result_proc = query_understanding_node(procedural_state)
    assert result_proc["query_type"] == "procedural"
    assert result_proc["is_ambiguous"] is False

    # Comparative test
    comp_state = {"raw_query": "difference between casual leave and annual leave", "standalone_query": "difference between casual leave and annual leave"}
    result_comp = query_understanding_node(comp_state)
    assert result_comp["query_type"] == "comparative"


def test_langgraph_ambiguous_flow():
    # Ambiguous query should route through clarification agent directly
    initial_state = {
        "session_id": "test-session-123",
        "raw_query": "info",
        "chat_history": [],
        "standalone_query": "info",
        "query_type": "ambiguous",
        "is_ambiguous": True,
        "clarification_prompt": None,
        "retrieved_chunks": [],
        "reranked_chunks": [],
        "generated_answer": "",
        "citations": [],
        "confidence_score": 0.0,
        "is_knowledge_gap": False,
        "domain_filter": None,
    }

    result = query_resolution_graph.invoke(initial_state)
    assert result["is_ambiguous"] is True
    assert "clarify" in result["generated_answer"].lower() or "broad" in result["generated_answer"].lower() or "specify" in result["generated_answer"].lower()
