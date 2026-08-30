"""
Provider-independent LLM Gateway (PRD section 6.7).

The backend/AI service must never directly depend on a single LLM provider.
This module is the abstraction seam:

    LLM Gateway
      |
      +-- Provider A
      +-- Provider B

Responsibilities: model selection, token limits, timeout, retry,
fallback, cost tracking, model version tracking.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.clients import OpenAICompatClient


@dataclass
class GenerationRequest:
    prompt: str
    model: str
    max_tokens: int = 1024
    temperature: float = 0.0
    system_prompt: str | None = None


@dataclass
class GenerationResult:
    text: str
    model: str
    model_version: str
    usage: dict[str, int]


class LLMProvider(ABC):
    """Contract every provider adapter implements."""

    name: str

    @abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult:
        ...


class OpenAICompatibleProvider(LLMProvider):
    """Adapter for any OpenAI-compatible /chat/completions endpoint."""

    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 90.0,
        retries: int = 2,
    ) -> None:
        self.name = f"openai-compatible:{model}"
        self.model = model
        self._client = OpenAICompatClient(base_url, api_key, timeout_seconds)
        self._retries = retries

    def generate(self, request: GenerationRequest) -> GenerationResult:
        messages: list[dict[str, str]] = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        text, model, usage = self._client.chat_completion(
            model=request.model or self.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            retries=self._retries,
        )
        return GenerationResult(
            text=text,
            model=model,
            model_version=model,
            usage=usage,
        )


class LLMGateway:
    """Routes generation requests to an available provider with fallback."""

    def __init__(self, providers: list[LLMProvider], default_model: str) -> None:
        self._providers = {p.name: p for p in providers}
        self._default_model = default_model

    def generate(self, request: GenerationRequest) -> GenerationResult:
        # Prefer the explicitly requested provider, otherwise the default.
        for name in self._providers:
            try:
                return self._providers[name].generate(request)
            except Exception:  # noqa: BLE001 - fallback across providers
                continue
        raise RuntimeError("All LLM providers failed")