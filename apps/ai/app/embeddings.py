"""Embedding providers (PRD 6.7 spirit — provider independence).

Mirrors the LLM gateway abstraction so the retrieval pipeline never
depends on a specific embedding vendor.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.clients import OpenAICompatClient


@dataclass
class EmbeddingResponse:
    embeddings: list[list[float]]
    model: str
    dimensions: int
    usage: dict[str, int]


class EmbeddingProvider(ABC):
    name: str
    dimensions: int

    @abstractmethod
    def embed(self, texts: list[str]) -> EmbeddingResponse:
        ...


class OpenAICompatibleEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str,
        dimensions: int,
        timeout_seconds: float = 90.0,
    ) -> None:
        self.name = f"openai-compatible:{model}"
        self.model = model
        self.dimensions = dimensions
        self._client = OpenAICompatClient(base_url, api_key, timeout_seconds)

    def embed(self, texts: list[str]) -> EmbeddingResponse:
        # Cap per-request payloads; large batches are re-chunked by the caller.
        if len(texts) > 128:
            # keep ordering stable
            flat: dict[int, list[float]] = {}
            for start in range(0, len(texts), 128):
                batch = texts[start : start + 128]
                result = self._client.embeddings(self.model, batch, self.dimensions)
                for i, vec in enumerate(result[0]):
                    flat[start + i] = vec
            ordered = [flat[i] for i in range(len(texts))]
            return EmbeddingResponse(ordered, self.model, self.dimensions, {})
        vectors, model, usage = self._client.embeddings(
            self.model, texts, self.dimensions
        )
        return EmbeddingResponse(vectors, model, self.dimensions, usage)