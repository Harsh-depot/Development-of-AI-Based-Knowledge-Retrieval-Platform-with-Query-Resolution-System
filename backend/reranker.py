import math
import logging
from typing import List, Dict, Any, Tuple
from config import settings

logger = logging.getLogger("reranker")


class RerankerEngine:
    """Stage-2 Precision Cross-Encoder Reranker using FlashRank (ms-marco-MiniLM-L-6-v2)
    and Sigmoid-calibrated confidence scoring: C = 1 / (1 + exp(-z)).
    Uses lazy loading to stay well within Render's 512 MB memory limit.
    """

    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.FLASHRANK_MODEL_NAME or "ms-marco-MiniLM-L-12-v2"
        self._ranker = None
        self._ranker_initialized = False

    @property
    def ranker(self):
        """Lazy-loaded FlashRank cross-encoder to minimize idle RAM footprint."""
        if not self._ranker_initialized:
            self._ranker_initialized = True
            try:
                from flashrank import Ranker
                self._ranker = Ranker(model_name=self.model_name)
                logger.info(f"Initialized FlashRank model: {self.model_name}")
            except Exception as e:
                logger.warning(f"Failed to load FlashRank with {self.model_name}: {e}. Falling back to default Ranker.")
                try:
                    from flashrank import Ranker
                    self._ranker = Ranker()
                except Exception as e2:
                    logger.error(f"Failed to load fallback Ranker: {e2}")
                    self._ranker = None
        return self._ranker

    @staticmethod
    def calculate_sigmoid_confidence(raw_score: float) -> float:
        """Computes calibrated Sigmoid confidence score C = 1 / (1 + exp(-z)).
        Clamped between -15 and 15 to prevent floating-point overflow.
        """
        z = max(min(float(raw_score), 15.0), -15.0)
        confidence = 1.0 / (1.0 + math.exp(-z))
        return round(float(confidence), 4)

    def rerank_chunks(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        top_k: int = None,
        threshold: float = None,
    ) -> Tuple[List[Dict[str, Any]], float, bool]:
        """Reranks candidate chunks using FlashRank cross-encoder,
        calibrates confidence using Sigmoid, and filters by threshold (0.40).

        Returns:
            reranked_chunks: List of filtered chunks sorted by confidence
            best_confidence: Max confidence score (0.0 to 1.0)
            is_knowledge_gap: True if all chunks are below threshold or no chunks found
        """
        top_k = top_k or settings.RERANK_TOP_K
        threshold = threshold or settings.CONFIDENCE_THRESHOLD

        if not chunks:
            return [], 0.0, True

        passages = []
        for i, c in enumerate(chunks):
            passages.append(
                {
                    "id": c.get("chunk_id", i),
                    "text": c.get("chunk_text", ""),
                    "meta": {
                        "document_id": c.get("document_id", ""),
                        "filename": c.get("filename", "Unknown Document"),
                        "page_number": c.get("page_number", 1),
                        "chunk_index": c.get("chunk_index", 0),
                        "raw_vector_score": c.get("score", 0.0),
                    },
                }
            )

        reranked_list = []
        active_ranker = self.ranker
        if active_ranker:
            try:
                from flashrank import RerankRequest
                rerank_request = RerankRequest(query=query, passages=passages)
                results = active_ranker.rerank(rerank_request)
                for res in results:
                    raw_score = float(res.get("score", 0.0))
                    meta = res.get("meta", {})
                    vec_score = float(meta.get("raw_vector_score", 0.0))

                    # Calibrated Sigmoid Confidence Scoring:
                    # 1. If cross-encoder has high confidence, trust it directly
                    # 2. If vector retrieval was strong (>= threshold) but cross-encoder is low due to formatting/pronouns,
                    #    calibrate confidence using Sigmoid C = 1 / (1 + exp(-z))
                    # 3. If both vector and cross-encoder are low, confidence remains < threshold, marking a Knowledge Gap
                    if raw_score >= threshold:
                        confidence = round(raw_score, 4)
                    elif vec_score >= threshold:
                        # Logit z scales with vector similarity and any non-zero cross-encoder signal
                        z = (vec_score - threshold) * 8.0 + (raw_score * 5.0)
                        calibrated_sig = self.calculate_sigmoid_confidence(z)
                        confidence = round(max(vec_score, calibrated_sig), 4)
                    else:
                        confidence = round(max(raw_score, vec_score), 4)

                    item = {
                        "chunk_id": res.get("id"),
                        "chunk_text": res.get("text", ""),
                        "document_id": meta.get("document_id", ""),
                        "filename": meta.get("filename", "Unknown Document"),
                        "page_number": meta.get("page_number", 1),
                        "chunk_index": meta.get("chunk_index", 0),
                        "raw_score": raw_score,
                        "confidence_score": confidence,
                    }
                    reranked_list.append(item)
            except Exception as e:
                logger.error(f"Error during FlashRank reranking: {e}. Falling back to vector scores.")
                reranked_list = self._fallback_scoring(chunks)
        else:
            reranked_list = self._fallback_scoring(chunks)

        # Sort by confidence score descending
        reranked_list.sort(key=lambda x: x["confidence_score"], reverse=True)

        best_confidence = reranked_list[0]["confidence_score"] if reranked_list else 0.0

        # Filter chunks below threshold (0.40)
        filtered_chunks = [c for c in reranked_list if c["confidence_score"] >= threshold]

        # Knowledge gap detected if all chunks fall below threshold
        is_knowledge_gap = len(filtered_chunks) == 0

        # Limit to top_k
        final_chunks = filtered_chunks[:top_k]

        import gc
        gc.collect()

        return final_chunks, best_confidence, is_knowledge_gap

    def _fallback_scoring(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for c in chunks:
            raw_score = float(c.get("score", 0.5))
            confidence = round(raw_score, 4) if 0.0 <= raw_score <= 1.0 else self.calculate_sigmoid_confidence(raw_score)
            results.append(
                {
                    "chunk_id": c.get("chunk_id", ""),
                    "chunk_text": c.get("chunk_text", ""),
                    "document_id": c.get("document_id", ""),
                    "filename": c.get("filename", "Unknown Document"),
                    "page_number": c.get("page_number", 1),
                    "chunk_index": c.get("chunk_index", 0),
                    "raw_score": raw_score,
                    "confidence_score": confidence,
                }
            )
        return results


# Global singleton instance (lazy properties keep memory low until used)
reranker_engine = RerankerEngine()
