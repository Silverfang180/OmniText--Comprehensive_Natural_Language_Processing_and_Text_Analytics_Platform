"""Text Embedding Encoder Service using SentenceTransformers."""

from typing import Any

from omnitext.core.logging import logger

try:
    from sentence_transformers import SentenceTransformer
    HAS_ST = True
except ImportError:
    HAS_ST = False


class TextEncoder:
    """Encoder class for loading and running sentence embeddings model."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model_name = model_name
        self.model: Any = None

    def load(self) -> None:
        """Load the SentenceTransformer model if not already loaded."""
        if self.model is None:
            if HAS_ST:
                logger.info(f"Loading SentenceTransformer model: {self.model_name}")
                self.model = SentenceTransformer(self.model_name)
            else:
                logger.warning("sentence-transformers not installed; using dummy encoder mode")

    def encode(self, texts: list[str]) -> list[list[float]]:
        """Generate list of 384-dimension embeddings for the given list of texts."""
        if not texts:
            return []
        self.load()
        if self.model is not None:
            embeddings = self.model.encode(texts)
            # Convert numpy float arrays to standard list of floats
            return [[float(x) for x in emb] for emb in embeddings]

        # Return mock normalized dummy vector of dimension 384
        logger.debug(f"Dummy encoding {len(texts)} texts")
        dummy_vec = [1.0 / (384 ** 0.5)] * 384
        return [list(dummy_vec) for _ in range(len(texts))]


# Singleton encoder instance
encoder = TextEncoder()
