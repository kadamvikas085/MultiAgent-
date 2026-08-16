"""
BaseAgent: shared contract for every agent in the multi-agent pipeline.

Each agent:
  1. Reads whatever it needs from the shared PipelineState.
  2. Does its work (LLM call, DB call, rules, etc).
  3. Returns a partial state update (LangGraph merges this into the state).
  4. Always attaches a confidence score + source attribution for explainability.
"""
import time
from abc import ABC, abstractmethod
from typing import Any

from loguru import logger

from app.graphs.state import PipelineState


class BaseAgent(ABC):
    name: str = "base_agent"

    def __init__(self, llm_service=None):
        self.llm_service = llm_service

    async def __call__(self, state: PipelineState) -> dict[str, Any]:
        start = time.perf_counter()
        logger.info(f"[{self.name}] starting | upload_id={state.get('upload_id')}")
        try:
            result = await self.run(state)
        except Exception as exc:  # noqa: BLE001
            # Do not silently continue with a partially-populated state.
            # The Celery task owns the global failure boundary and will persist
            # the real pipeline stage + error message for the UI.
            logger.exception(f"[{self.name}] failed: {exc}")
            raise
        latency_ms = int((time.perf_counter() - start) * 1000)
        logger.info(f"[{self.name}] done in {latency_ms}ms")

        agent_log = state.get("agent_logs", [])
        agent_log.append(
            {
                "agent_name": self.name,
                "confidence": result.get("confidence"),
                "latency_ms": latency_ms,
                "output": {
                    k: v
                    for k, v in result.items()
                    if k not in {"agent_logs"} and k in {
                        "extracted_fields", "validation_flags", "conflicts",
                        "retrieved_context", "reasoning_output", "kg_nodes",
                        "kg_edges", "seo_metadata", "related_product_ids",
                        "compliance_flags", "generated_product",
                        "overall_confidence", "requires_human_review",
                    }
                },
            }
        )
        result["agent_logs"] = agent_log
        return result

    @abstractmethod
    async def run(self, state: PipelineState) -> dict[str, Any]:
        """Implemented by each concrete agent. Must return a partial state dict."""
        raise NotImplementedError


