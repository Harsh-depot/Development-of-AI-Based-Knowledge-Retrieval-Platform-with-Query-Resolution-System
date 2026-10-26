import math
import pytest
from reranker import RerankerEngine

def test_sigmoid_confidence_calculation():
    # Test formula: C = 1 / (1 + exp(-z))
    # For z = 0 -> C = 0.5
    assert RerankerEngine.calculate_sigmoid_confidence(0.0) == 0.5

    # For positive z -> C > 0.5
    conf_pos = RerankerEngine.calculate_sigmoid_confidence(2.0)
    expected_pos = round(1.0 / (1.0 + math.exp(-2.0)), 4)
    assert conf_pos == expected_pos
    assert conf_pos > 0.8

    # For negative z -> C < 0.5
    conf_neg = RerankerEngine.calculate_sigmoid_confidence(-2.0)
    expected_neg = round(1.0 / (1.0 + math.exp(2.0)), 4)
    assert conf_neg == expected_neg
    assert conf_neg < 0.2

    # Clamping test to prevent overflow
    assert RerankerEngine.calculate_sigmoid_confidence(100.0) == 1.0
    assert RerankerEngine.calculate_sigmoid_confidence(-100.0) == 0.0


def test_reranker_threshold_and_knowledge_gap():
    engine = RerankerEngine()
    
    mock_chunks = [
        {"chunk_id": "c1", "chunk_text": "Company policy allows 24 days annual leave.", "score": 0.95},
        {"chunk_id": "c2", "chunk_text": "Leaves must be approved by manager.", "score": 0.85},
        {"chunk_id": "c3", "chunk_text": "Unrelated paragraph about office catering.", "score": 0.10},
    ]

    filtered, best_conf, is_gap = engine.rerank_chunks(
        query="What is the annual leave allowance?",
        chunks=mock_chunks,
        threshold=0.40,
    )

    assert not is_gap
    assert best_conf >= 0.40
    assert len(filtered) >= 1


def test_reranker_knowledge_gap_detection():
    engine = RerankerEngine()
    
    # Low confidence chunks below 0.40
    mock_chunks = [
        {"chunk_id": "c1", "chunk_text": "Irrelevant text about quantum computing.", "score": 0.15},
        {"chunk_id": "c2", "chunk_text": "Another unrelated text about astrophysics.", "score": 0.20},
    ]

    filtered, best_conf, is_gap = engine.rerank_chunks(
        query="What is the student grading scale?",
        chunks=mock_chunks,
        threshold=0.40,
    )

    assert is_gap is True
    assert len(filtered) == 0
