"""
Mock LLM Service
-----------------
Drop-in, offline replacement for LLMService (see app/services/llm_service.py).
Selected automatically when USE_MOCK_LLM=true (the default) via
`get_llm_service()`, so the entire pipeline — extraction, validation,
reasoning, SEO, compliance — can run end-to-end without an OPENAI_API_KEY and
without consuming any external LLM API request/RPD budget.

Design notes:
- Same public method signatures as LLMService (generate_json, generate_text,
  describe_image), so agents never need to know which implementation they
  got — only app/graphs/pipeline_graph.py decides that, via get_llm_service().
- generate_json() is a single generic entry point shared by five different
  agents (extraction/validation/reasoning/seo/compliance), each with its own
  expected JSON shape. This mock recognizes each agent's prompt by a stable
  marker string in its prompt template and returns a schema-compatible,
  deterministic (not random) mock payload built from the real input where
  possible (e.g. the extraction mock pulls a name from the document text).
- Intentionally simple: this is prototype infrastructure, not a simulated
  LLM. It should be obvious to a reader which agent triggered which branch.
"""
import ast
import hashlib
import re
from datetime import datetime, timezone


def _first_meaningful_line(text: str) -> str:
    for line in (text or "").splitlines():
        stripped = line.strip()
        if len(stripped) >= 3:
            return stripped[:120]
    return "Sample Industrial Product"


def _stable_sku(seed: str) -> str:
    digest = hashlib.sha1((seed or "unknown").encode("utf-8")).hexdigest()[:8].upper()
    return f"MOCK-{digest}"


class MockLLMService:
    """Offline stand-in for LLMService. Makes zero network calls."""

    def __init__(self):
        self.model = "mock-llm-offline"

    async def generate_json(self, prompt: str, temperature: float = 0.2) -> dict:
        if "extract a structured product record" in prompt:
            return self._mock_extraction(prompt)
        if "fact-checking validator" in prompt:
            return self._mock_validation()
        if "senior industrial-catalog editor" in prompt:
            return self._mock_reasoning(prompt)
        if "SEO metadata" in prompt:
            return self._mock_seo(prompt)
        if "compliance reviewer" in prompt:
            return self._mock_compliance(prompt)
        # Unknown prompt shape: fail soft rather than raising, matching the
        # real LLMService's behavior on a JSON parse error.
        return {"_parse_error": True, "_raw": "", "_mock": True}

    async def generate_text(self, prompt: str, temperature: float = 0.3) -> str:
        return (
            "[MOCK LLM] This is placeholder offline text generated because "
            "USE_MOCK_LLM=true. Set USE_MOCK_LLM=false and configure "
            "OPENAI_API_KEY to get real model output."
        )

    async def describe_image(self, image_url: str, instruction: str) -> dict:
        return {
            "description": "[MOCK LLM] Offline placeholder image description.",
            "_mock": True,
        }

    # ------------------------------------------------------------------
    # Per-agent mock payloads
    # ------------------------------------------------------------------
    def _mock_extraction(self, prompt: str) -> dict:
        match = re.search(r"DOCUMENT TEXT:\n(.*?)\n\nTABLES", prompt, re.DOTALL)
        text = match.group(1) if match else ""
        name = _first_meaningful_line(text)
        return {
            "name": name,
            "sku": _stable_sku(name),
            "category": "Industrial Components",
            "description": (
                f"{name} — offline mock extraction generated from the uploaded "
                "document. Enable real API mode for LLM-generated descriptions."
            ),
            "specifications": {"material": "Not specified (mock mode)", "rating": "N/A"},
            "technical_details": {"source": "mock_llm", "generated_at": datetime.now(timezone.utc).isoformat()},
            "attributes": {"finish": "unspecified"},
            "applications": ["General industrial use"],
            "_mock": True,
        }

    def _mock_validation(self) -> dict:
        return {
            "flags": [
                {
                    "field": "specifications",
                    "issue": "Mock mode: specifications not verified against source text.",
                    "severity": "low",
                }
            ],
            "conflicts": [],
            "_mock": True,
        }

    def _mock_reasoning(self, prompt: str) -> dict:
        # ReasoningAgent's caller does
        # `reasoning.get("refined_fields", extracted_fields)`, which only
        # falls back on a MISSING key, not an empty dict — so returning {}
        # here would silently blank out every downstream field (SEO,
        # knowledge graph, compliance, final product). We pass the extracted
        # fields straight through instead, matching "no-op reasoning" in mock
        # mode.
        fields_match = re.search(r"EXTRACTED FIELDS:\n(.*?)\n\nVALIDATION FLAGS", prompt, re.DOTALL)
        refined_fields: dict = {}
        if fields_match:
            try:
                parsed = ast.literal_eval(fields_match.group(1).strip())
                if isinstance(parsed, dict):
                    refined_fields = parsed
            except (ValueError, SyntaxError):
                refined_fields = {}

        return {
            "refined_fields": refined_fields,
            "inferred_fields": [],
            "reasoning_notes": (
                "Offline/mock reasoning: no external LLM call was made "
                "(USE_MOCK_LLM=true). Fields were passed through unchanged "
                "from extraction."
            ),
            "_mock": True,
        }

    def _mock_seo(self, prompt: str) -> dict:
        return {
            "seo_title": "Industrial Product | Mock SEO Title",
            "seo_description": (
                "Mock SEO description generated offline (USE_MOCK_LLM=true). "
                "Enable real API mode for optimized copy."
            )[:160],
            "seo_keywords": [
                "industrial equipment",
                "b2b supplier",
                "wholesale components",
                "mock keyword",
                "offline demo",
            ],
            "_mock": True,
        }

    def _mock_compliance(self, prompt: str) -> dict:
        return {
            "compliance_flags": [
                {
                    "issue": "Mock mode: no real compliance/regulatory review was performed.",
                    "severity": "low",
                    "recommendation": "Re-run with USE_MOCK_LLM=false before publishing for real.",
                }
            ],
            "_mock": True,
        }
