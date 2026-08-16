"""
Gemini Copilot Service
----------------------
Gemini is used ONLY by the AI Copilot.

The main AI pipeline continues to use get_llm_service()
and therefore remains controlled by USE_MOCK_LLM.

Google provides an OpenAI-compatible endpoint for Gemini,
so the existing openai Python package can be reused without
changing the rest of the application.
"""

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings


class GeminiCopilotService:
    """LLM client dedicated exclusively to the AI Copilot."""

    GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

    def __init__(self):
        if not settings.GEMINI_API_KEY.strip():
            raise RuntimeError(
                "GEMINI_API_KEY is missing. "
                "Add it to Backend/.env before using AI Copilot."
            )

        self.client = AsyncOpenAI(
            api_key=settings.GEMINI_API_KEY,
            base_url=self.GEMINI_BASE_URL,
        )

        self.model = settings.GEMINI_MODEL

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(
            multiplier=1,
            min=1,
            max=10,
        ),
    )
    async def generate_text(
        self,
        prompt: str,
        temperature: float = 0.3,
    ) -> str:
        """Generate a text answer using Gemini."""

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are IntelliSpec Copilot, an AI assistant "
                        "for industrial product intelligence."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=temperature,
        )

        return response.choices[0].message.content or ""