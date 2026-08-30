"""Minimal OpenAI-compatible HTTP client (httpx).

Both chat completions and embeddings are available through the same
endpoint shape, so a single client serves the LLM gateway and the
embedding provider.
"""

from __future__ import annotations

from typing import Any

import httpx


class OpenAICompatError(RuntimeError):
    """Raised when an upstream provider returns an error or times out."""


class OpenAICompatClient:
    def __init__(self, base_url: str, api_key: str, timeout_seconds: float = 90.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._client = httpx.Client(timeout=timeout_seconds)

    def close(self) -> None:
        self._client.close()

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    def _post(self, path: str, body: dict[str, Any], retries: int) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                resp = self._client.post(
                    f"{self._base_url}/{path}", json=body, headers=self._headers()
                )
                resp.raise_for_status()
                return resp.json()
            except (httpx.HTTPError, ValueError) as exc:  # network + non-JSON responses
                last_error = exc
                if attempt < retries:
                    continue
        raise OpenAICompatError(f"Provider request failed for {path}: {last_error}")

    def embeddings(
        self, model: str, texts: list[str], dimensions: int | None = None
    ) -> tuple[list[list[float]], str, dict[str, int]]:
        body: dict[str, Any] = {"model": model, "input": texts}
        if dimensions:
            body["dimensions"] = dimensions
        data = self._post("embeddings", body, retries=2)
        ordering = {d["index"]: d["embedding"] for d in data.get("data", [])}
        embedded = [ordering[i] for i in sorted(ordering)]
        return embedded, str(data.get("model", model)), dict(data.get("usage", {}))

    def chat_completion(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 1024,
        retries: int = 2,
    ) -> tuple[str, str, dict[str, Any]]:
        body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        data = self._post("chat/completions", body, retries=retries)
        choices = data.get("choices") or []
        if not choices:
            raise OpenAICompatError("Provider returned no choices")
        content = choices[0].get("message", {}).get("content", "")
        return str(content), str(data.get("model", model)), dict(data.get("usage", {}))