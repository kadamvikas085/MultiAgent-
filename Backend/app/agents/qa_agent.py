"""
Quality Assurance Agent
------------------------
Final stage before Human Review. Aggregates every upstream agent's confidence
score into a per-field and overall confidence score, and decides whether the
record can pass straight to "Generated Product" or must be routed to the
Validation Center for human-in-the-loop review.
"""
from typing import Any

from app.agents.base_agent import BaseAgent
from app.graphs.state import PipelineState

REVIEW_THRESHOLD = 0.75


class QualityAssuranceAgent(BaseAgent):
    name = "qa_agent"

    async def run(self, state: PipelineState) -> dict[str, Any]:
        agent_logs = state.get("agent_logs", [])
        confidences = [
            log["confidence"] for log in agent_logs if log.get("confidence") is not None
        ]
        overall = sum(confidences) / len(confidences) if confidences else 0.5

        flags = state.get("validation_flags", []) + state.get("compliance_flags", [])
        has_high_severity_flag = any(f.get("severity") == "high" for f in flags)

        requires_review = overall < REVIEW_THRESHOLD or has_high_severity_flag

        refined = state.get("reasoning_output", {}).get(
            "refined_fields", state.get("extracted_fields", {})
        )
        generated_product = {
            **refined,
            "seo_title": state.get("seo_metadata", {}).get("seo_title"),
            "seo_description": state.get("seo_metadata", {}).get("seo_description"),
            "seo_keywords": state.get("seo_metadata", {}).get("seo_keywords"),
            "related_product_ids": state.get("related_product_ids", []),
            "confidence_score": round(overall, 3),
        }

        return {
            "overall_confidence": round(overall, 3),
            "requires_human_review": requires_review,
            "generated_product": generated_product,
            "confidence": overall,
        }


