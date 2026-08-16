"""
SEO Agent
---------
Generates SEO title, meta description, and keyword list for the product,
optimized for industrial B2B search intent.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState

SEO_PROMPT = """Generate B2B industrial-commerce SEO metadata for this product.

PRODUCT FIELDS:
{fields}

Return ONLY valid JSON:
{{
  "seo_title": string,       // <= 60 chars
  "seo_description": string, // <= 160 chars
  "seo_keywords": string[]   // 5-10 keywords, buyer-intent phrasing
}}
"""


class SEOAgent(BaseAgent):
    name = "seo_agent"

    async def run(self, state: PipelineState) -> dict[str, Any]:
        fields = state.get("reasoning_output", {}).get(
            "refined_fields", state.get("extracted_fields", {})
        )
        seo = await self.llm_service.generate_json(SEO_PROMPT.format(fields=fields))

        return {"seo_metadata": seo, "confidence": 0.9}


