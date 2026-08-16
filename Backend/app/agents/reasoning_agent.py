"""
Reasoning Agent
---------------
Performs RAG over the Qdrant vector store (similar/related products, historical
catalog entries) to fill missing information, resolve validation conflicts,
and produce a refined, well-written description. This is the "Missing
Information Prediction" + "Automatic Description Generation" capability.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState
from app.services.vector_store_service import VectorStoreService

REASONING_PROMPT = """You are a senior industrial-catalog editor. Using the extracted fields,
any flagged conflicts, and similar reference products retrieved from the catalog, produce a
refined, accurate product record. Resolve conflicts in favor of the source document. For any
field that is missing, infer a reasonable value ONLY if strongly supported by the reference
context, and mark it in `inferred_fields`; otherwise leave it null.

EXTRACTED FIELDS:
{fields}

VALIDATION FLAGS:
{flags}

REFERENCE CONTEXT (similar catalog products):
{context}

Return ONLY valid JSON:
{{
  "refined_fields": object,
  "inferred_fields": string[],
  "reasoning_notes": string
}}
"""


class ReasoningAgent(BaseAgent):
    name = "reasoning_agent"

    def __init__(self, llm_service=None, vector_store: VectorStoreService | None = None):
        super().__init__(llm_service)
        self.vector_store = vector_store

    async def run(self, state: PipelineState) -> dict[str, Any]:
        fields = state.get("extracted_fields", {})
        query_text = f"{fields.get('name', '')} {fields.get('category', '')}"

        retrieved = await self.vector_store.search(query_text, top_k=5)

        result = await self.llm_service.generate_json(
            REASONING_PROMPT.format(
                fields=fields,
                flags=state.get("validation_flags", []),
                context=retrieved,
            )
        )

        return {
            "retrieved_context": retrieved,
            "reasoning_output": result,
            "confidence": 0.85 if not result.get("inferred_fields") else 0.65,
        }


