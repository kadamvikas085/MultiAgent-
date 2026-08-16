"""
Embedding Service
------------------
Wraps the BGE embedding model (via sentence-transformers) used for both
document-chunk embeddings and product-similarity embeddings stored in Qdrant.
"""
from functools import lru_cache

from app.core.config import settings


class EmbeddingService:
    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self._model = None

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed_text(self, text: str) -> list[float]:
        return self.model.encode(text, normalize_embeddings=True).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return self.model.encode(texts, normalize_embeddings=True, batch_size=32).tolist()

    def chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
        """Simple sliding-window chunker; swap for a semantic chunker later if needed."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start = end - overlap
        return [c for c in chunks if c.strip()]


@lru_cache
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()


