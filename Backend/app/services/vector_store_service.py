"""
Vector Store Service (Qdrant)
------------------------------
Handles indexing and similarity search over product/document embeddings.
Used by the Reasoning Agent (RAG context) and the Recommendation Agent
(related products).
"""
import uuid

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import Distance, PointStruct, VectorParams

from app.core.config import settings
from app.services.embedding_service import get_embedding_service


class VectorStoreService:
    def __init__(self):
        self.client = AsyncQdrantClient(url=settings.QDRANT_URL)
        self.collection = settings.QDRANT_COLLECTION
        self.embedder = get_embedding_service()

    async def ensure_collection(self, vector_size: int = 1024) -> None:
        collections = await self.client.get_collections()
        names = [c.name for c in collections.collections]
        if self.collection not in names:
            await self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )

    async def upsert(self, text: str, payload: dict) -> str:
        await self.ensure_collection()
        vector = self.embedder.embed_text(text)
        point_id = str(uuid.uuid4())
        await self.client.upsert(
            collection_name=self.collection,
            points=[PointStruct(id=point_id, vector=vector, payload=payload)],
        )
        return point_id

    async def search(self, query_text: str, top_k: int = 5) -> list[dict]:
        await self.ensure_collection()
        vector = self.embedder.embed_text(query_text)
        results = await self.client.search(
            collection_name=self.collection, query_vector=vector, limit=top_k
        )
        return [{"score": r.score, **(r.payload or {})} for r in results]


