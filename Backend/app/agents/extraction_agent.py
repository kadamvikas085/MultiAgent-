"""
Extraction Agent
----------------
Consumes raw_text + tables (produced by the OCR/parsing stage, upstream of the
graph) and pulls structured product fields out of them using the LLM, with a
JSON-schema-constrained prompt so the output is directly usable downstream.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState

EXTRACTION_SCHEMA_PROMPT = """You are a product-data extraction engine for industrial commerce.
Given raw document text and any tables, extract a structured product record.

Return ONLY valid JSON with this shape:
{{
  "name": string,
  "sku": string | null,
  "category": string | null,
  "description": string,
  "specifications": object,       // key -> value spec pairs
  "technical_details": object,    // dimensions, materials, ratings, etc.
  "attributes": object,           // color, finish, certification, etc.
  "applications": string[]        // typical use cases
}}

DOCUMENT TEXT:
{text}

TABLES (JSON):
{tables}
"""


class ExtractionAgent(BaseAgent):
    name = "extraction_agent"

    async def run(self, state: PipelineState) -> dict[str, Any]:
        prompt = EXTRACTION_SCHEMA_PROMPT.format(
            text=state.get("raw_text", "")[:12000],
            tables=state.get("tables", []),
        )
        extracted = await self.llm_service.generate_json(prompt)

        return {
            "extracted_fields": extracted,
            "confidence": extracted.get("_confidence", 0.8),
        }


