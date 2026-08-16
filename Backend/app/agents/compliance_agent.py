"""
Compliance Agent
----------------
Checks the generated product record for regulatory/compliance red flags —
e.g. missing safety certifications for regulated categories, banned-substance
mentions, or export-control keywords — before it's allowed into the catalog.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState

COMPLIANCE_PROMPT = """You are a compliance reviewer for an industrial product catalog.
Review this product record for compliance risks: missing required certifications
for its category (e.g. CE, UL, RoHS, ISO), restricted/hazardous materials mentioned
without proper handling disclosures, or misleading claims (e.g. unverifiable
"certified" claims with no standard named).

PRODUCT FIELDS:
{fields}

Return ONLY valid JSON:
{{
  "compliance_flags": [
    {{"issue": string, "severity": "low"|"medium"|"high", "recommendation": string}}
  ]
}}
"""


class ComplianceAgent(BaseAgent):
    name = "compliance_agent"

    async def run(self, state: PipelineState) -> dict[str, Any]:
        fields = state.get("reasoning_output", {}).get(
            "refined_fields", state.get("extracted_fields", {})
        )
        result = await self.llm_service.generate_json(
            COMPLIANCE_PROMPT.format(fields=fields)
        )
        flags = result.get("compliance_flags", [])
        high_severity = any(f.get("severity") == "high" for f in flags)

        return {
            "compliance_flags": flags,
            "confidence": 0.5 if high_severity else 0.95,
        }


