"""Keyword and Keyphrase Extraction Task Adapter Implementation."""

import re
import time
from typing import Any

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput

# Standard list of common English stop words
STOP_WORDS = {
    "the", "and", "but", "or", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "to", "from", "up", "down",
    "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "can", "will", "just", "should", "now", "are", "was", "were",
    "been", "has", "have", "had", "does", "did", "this", "that", "these", "those", "am",
    "is", "having", "do", "doing", "would", "could", "ought", "them", "their", "they", "our",
    "your", "you", "him", "her", "his", "its", "it", "she", "who", "which", "what", "whom"
}


class KeywordExtractionAdapter(TaskAdapter):
    """Adapter implementing KeyBERT-style Keyword Extraction with Sentence Transformers."""

    def __init__(self, task_name: str = "keyword_extraction") -> None:
        self.task_name = task_name
        self.model_ref: ModelRef | None = None
        self.model: Any = None
        self._is_loaded: bool = False

    def load(self, model_ref: ModelRef) -> None:
        """Load and initialize the SentenceTransformer model."""
        from sentence_transformers import SentenceTransformer

        self.model_ref = model_ref
        model_id = model_ref.model_id
        # Load local or hugging face hub embeddings model
        self.model = SentenceTransformer(model_id, device="cpu")
        self._is_loaded = True

    def _extract_candidates(self, text: str) -> list[str]:
        """Extract unique alphanumeric word candidates from text excluding stop words."""
        # Find words of length 3 to 20
        words = re.findall(r"\b[a-zA-Z-]{3,20}\b", text.lower())
        candidates = []
        seen = set()
        for word in words:
            if word not in STOP_WORDS and word not in seen:
                candidates.append(word)
                seen.add(word)
        return candidates

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Extract top keywords ranked by cosine similarity with dynamic chunking."""
        if not self._is_loaded or self.model is None:
            raise RuntimeError("Model has not been loaded. Call load() first.")

        start_time = time.perf_counter()

        options = input_data.options or {}
        top_n = options.get("top_n", 8)

        text = input_data.text
        words = text.split()

        import numpy as np

        if len(words) > 400:
            from omnitext.ml.chunking.chunker import (
                aggregate_keywords,
                split_text_with_offsets,
            )
            chunks = split_text_with_offsets(text, max_words=400, overlap=0)
            
            keywords_list = []
            for chunk_txt, _ in chunks:
                cands = self._extract_candidates(chunk_txt)
                if not cands:
                    continue
                doc_embedding = self.model.encode([chunk_txt], convert_to_numpy=True)
                candidate_embeddings = self.model.encode(cands, convert_to_numpy=True)
                
                doc_norm = doc_embedding / np.linalg.norm(doc_embedding, axis=1, keepdims=True)
                cand_norm = candidate_embeddings / np.linalg.norm(candidate_embeddings, axis=1, keepdims=True)
                similarities = np.dot(cand_norm, doc_norm.T).flatten()
                
                ranked_indices = np.argsort(similarities)[::-1]
                chunk_kws = [
                    {"keyword": cands[idx], "score": float(similarities[idx])}
                    for idx in ranked_indices[:top_n]
                ]
                keywords_list.append(chunk_kws)
            keywords = aggregate_keywords(keywords_list, top_n)
        else:
            candidates = self._extract_candidates(text)
            if not candidates:
                keywords = []
            else:
                doc_embedding = self.model.encode([text], convert_to_numpy=True)
                candidate_embeddings = self.model.encode(candidates, convert_to_numpy=True)
                
                doc_norm = doc_embedding / np.linalg.norm(doc_embedding, axis=1, keepdims=True)
                cand_norm = candidate_embeddings / np.linalg.norm(candidate_embeddings, axis=1, keepdims=True)
                similarities = np.dot(cand_norm, doc_norm.T).flatten()
                
                ranked_indices = np.argsort(similarities)[::-1]
                keywords = [
                    {
                        "keyword": candidates[idx],
                        "score": round(float(similarities[idx]), 4),
                    }
                    for idx in ranked_indices[:top_n]
                ]

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TaskOutput(
            result={
                "keywords": keywords,
            },
            latency_ms=round(latency_ms, 2),
            model_id=self.model_ref.model_id if self.model_ref else "unknown",
            metadata={
                "task": self.task_name,
                "top_n": top_n,
            },
        )

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute prediction sequentially over inputs."""
        return [self.predict(item) for item in inputs]
