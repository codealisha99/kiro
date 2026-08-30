"""Request/response models for the AI service HTTP API."""

from typing import Literal

from pydantic import BaseModel, Field


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=128)
    model: str | None = None


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dimensions: int
    usage: dict[str, int] = {}


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class GenerateResponse(BaseModel):
    text: str
    model: str
    model_version: str
    usage: dict[str, int] = {}


class ProviderInfo(BaseModel):
    name: str
    kind: Literal["llm", "embedding"]
    model: str
    configured: bool


class GatewayStatus(BaseModel):
    llm_provider: str
    embedding_provider: str
    providers: list[ProviderInfo]