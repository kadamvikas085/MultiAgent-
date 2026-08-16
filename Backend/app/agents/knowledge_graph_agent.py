"""
Knowledge Graph Agent
---------------------
Projects the refined product record into the Neo4j knowledge graph: a Product
node connected to Category, Attribute, Application, and Manufacturer nodes.
Also performs duplicate detection by looking for existing nodes with a very
similar name/SKU before creating new ones.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState
from app.services.graph_db_service import GraphDBService


class KnowledgeGraphAgent(BaseAgent):
    name = "knowledge_graph_agent"

    def __init__(self, llm_service=None, graph_db: GraphDBService | None = None):
        super().__init__(llm_service)
        self.graph_db = graph_db

    async def run(self, state: PipelineState) -> dict[str, Any]:
        reasoning = state.get("reasoning_output", {})
        fields = reasoning.get("refined_fields", state.get("extracted_fields", {}))

        duplicate = await self.graph_db.find_similar_product(
            name=fields.get("name", ""), sku=fields.get("sku")
        )

        nodes, edges = await self.graph_db.upsert_product_graph(fields)

        return {
            "kg_nodes": nodes,
            "kg_edges": edges,
            "confidence": 0.5 if duplicate else 0.9,
            "validation_flags": (
                state.get("validation_flags", [])
                + (
                    [
                        {
                            "field": "name",
                            "issue": f"possible duplicate of existing product {duplicate}",
                            "severity": "medium",
                        }
                    ]
                    if duplicate
                    else []
                )
            ),
        }


