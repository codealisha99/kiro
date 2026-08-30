"""Configuration for the Kiro AI service.

All values are overridable via the environment using the ``AI_`` prefix
(e.g. ``AI_LLM_BASE_URL``) so the gateway stays provider-independent —
any OpenAI-compatible endpoint works (OpenAI, Groq, Together, LM Studio, ...).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AI_",
        env_file=["../../.env", ".env", "../.env"],
        extra="ignore",
    )

    # ---- LLM generation ----
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_max_tokens: int = 1024
    llm_temperature: float = 0.0
    llm_timeout_seconds: float = 90.0
    llm_retries: int = 2

    # ---- Embeddings ----
    # Falls back to the LLM credentials when left unset.
    embedding_base_url: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str = "text-embedding-3-small"
    # Must match the pgvector column from the api migrations (vector(1536)).
    embedding_dimensions: int = 1536

    @property
    def resolved_embedding_base_url(self) -> str:
        return self.embedding_base_url or self.llm_base_url

    @property
    def resolved_embedding_api_key(self) -> str:
        return self.embedding_api_key if self.embedding_api_key is not None else self.llm_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()