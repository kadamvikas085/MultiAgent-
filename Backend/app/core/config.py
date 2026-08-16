"""
Centralized application configuration.
All environment-driven settings are declared here and nowhere else,
so the rest of the codebase imports `settings` instead of touching os.environ.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    # --- App ---
    APP_NAME: str = "UniHack AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- Security ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Database ---
    DATABASE_URL: str

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # --- Qdrant ---
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "product_embeddings"

    # --- Neo4j ---
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neo4j"

    # --- LLM ---
    # USE_MOCK_LLM=true routes the main pipeline through
    # MockLLMService.
    #
    # IMPORTANT:
    # This setting continues to control the MAIN AI PIPELINE.
    # AI Copilot uses Gemini separately and does not depend on this flag.
    USE_MOCK_LLM: bool = True

    # Existing OpenAI configuration.
    # Kept unchanged so existing pipeline functionality is not affected.
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4.1"

    # --- Gemini Copilot ---
    # Gemini is used ONLY by the AI Copilot.
    #
    # This does NOT replace OPENAI_API_KEY and does NOT affect
    # USE_MOCK_LLM or the existing pipeline.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- Embeddings ---
    EMBEDDING_MODEL: str = "BAAI/bge-large-en-v1.5"

    # --- LLM rate-limit / usage tracking ---
    # Existing pipeline settings are preserved.
    LLM_MAX_RETRIES: int = 3
    LLM_RPM_LIMIT: int = 60
    LLM_RPD_LIMIT: int = 1000

    # --- CORS ---
    ALLOWED_ORIGINS: str = (
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://localhost:3000"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    # --- Storage ---
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_MB: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()