"""
LLM Service
-----------
Single choke point for all LLM calls (GPT-4.1 / Llama 3.3 via an
OpenAI-compatible endpoint, plus Qwen2.5-VL for vision). Centralizing this
makes it trivial to swap providers, add retries, and log token usage.
"""
import json

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings


class LLMService:
    def __init__(self):
        if not settings.OPENAI_API_KEY.strip():
            raise RuntimeError(
                "OPENAI_API_KEY is missing. Add it to Backend/.env before running "
                "the AI stages of the pipeline."
            )
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.LLM_MODEL

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def generate_json(self, prompt: str, temperature: float = 0.2) -> dict:
        """Runs a prompt expecting a strict JSON object back."""
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You return ONLY valid JSON. No markdown, no commentary.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"_parse_error": True, "_raw": content}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def generate_text(self, prompt: str, temperature: float = 0.3) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def describe_image(self, image_url: str, instruction: str) -> dict:
        """Vision call for image-based product sheets (Qwen2.5-VL / GPT-4.1 vision)."""
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": instruction},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"_parse_error": True, "_raw": content}


def get_llm_service():
    """
    Single switch point between mock and real LLM inference.

    USE_MOCK_LLM=true  -> MockLLMService (app/services/mock_llm_service.py),
                           no network calls, zero RPD consumption.
    USE_MOCK_LLM=false -> LLMService (this file), real OpenAI-compatible API,
                           requires OPENAI_API_KEY.

    Every agent/consumer (see app/graphs/pipeline_graph.py) goes through this
    function instead of instantiating LLMService directly, so switching modes
    never requires touching agent code — only the USE_MOCK_LLM env var.
    """
    if settings.USE_MOCK_LLM:
        from app.services.mock_llm_service import MockLLMService

        return MockLLMService()
    return LLMService()


