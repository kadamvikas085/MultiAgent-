"""
Validation Agent
----------------
Cross-checks extracted_fields against the source raw_text/tables to catch
hallucinated values, unit mismatches, and missing required fields. Produces
`validation_flags` consumed by the Validation Center UI for human review.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState

REQUIRED_FIELDS = ["name", "description", "specifications"]

VALIDATION_PROMPT = """You are a fact-checking validator. Compare the extracted product
fields against the source text and flag any value that is NOT supported by the source,
plus any conflicting numbers/units you find.

SOURCE TEXT:
{text}

EXTRACTED FIELDS (JSON):
{fields}

Return ONLY valid JSON:
{{
  "flags": [
    {{"field": string, "issue": string, "severity": "low"|"medium"|"high"}}
  ],
  "conflicts": [
    {{"field": string, "extracted_value": string, "source_snippet": string}}
  ]
}}
"""


class ValidationAgent(BaseAgent):
    name = "validation_agent"

    async def run(self, state: PipelineState) -> dict[str, Any]:
        fields = state.get("extracted_fields", {})

        missing = [f for f in REQUIRED_FIELDS if not fields.get(f)]
        flags = [
            {"field": f, "issue": "missing required field", "severity": "high"}
            for f in missing
        ]

        llm_result = await self.llm_service.generate_json(
            VALIDATION_PROMPT.format(
                text=state.get("raw_text", "")[:8000],
                fields=fields,
            )
        )
        flags.extend(llm_result.get("flags", []))
        conflicts = llm_result.get("conflicts", [])

        confidence = 1.0 - min(0.6, 0.1 * len(flags))

        return {
            "validation_flags": flags,
            "conflicts": conflicts,
            "confidence": max(confidence, 0.1),
        }


