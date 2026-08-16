"""
Recommendation Agent
---------------------
Combines vector similarity (Qdrant) and graph co-occurrence (Neo4j: products
sharing category/application nodes) to produce a ranked related-products list.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState
from app.services.graph_db_service import GraphDBService
from app.services.vector_store_service import VectorStoreService


class RecommendationAgent(BaseAgent):
    name = "recommendation_agent"

    def __init__(
        self,
        llm_service=None,
        vector_store: VectorStoreService | None = None,
        graph_db: GraphDBService | None = None,
    ):
        super().__init__(llm_service)
        self.vector_store = vector_store
        self.graph_db = graph_db

    async def run(self, state: PipelineState) -> dict[str, Any]:
        fields = state.get("reasoning_output", {}).get(
            "refined_fields", state.get("extracted_fields", {})
        )
        query_text = f"{fields.get('name', '')} {fields.get('category', '')}"

        vector_matches = await self.vector_store.search(query_text, top_k=8)
        graph_matches = await self.graph_db.find_related_products(
            category=fields.get("category"), applications=fields.get("applications", [])
        )

        # Merge + de-dupe, vector similarity takes priority ordering
        seen: set[str] = set()
        ranked: list[str] = []
        for m in vector_matches + graph_matches:
            pid = m.get("product_id") if isinstance(m, dict) else None
            if pid and pid not in seen:
                seen.add(pid)
                ranked.append(pid)

        return {"related_product_ids": ranked[:6], "confidence": 0.75}


