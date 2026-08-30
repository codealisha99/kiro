"""HTTP routes exposing the provider-independent gateway + embeddings."""

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.embeddings import OpenAICompatibleEmbeddingProvider
from app.llm_gateway import GenerationRequest, LLMProvider, OpenAICompatibleProvider
from app.schemas import (
    EmbedRequest,
    EmbedResponse,
    GenerateRequest,
    GenerateResponse,
    GatewayStatus,
    ProviderInfo,
)

router = APIRouter()

_settings = get_settings()
_llm_provider = OpenAICompatibleProvider(
    model=_settings.llm_model,
    base_url=_settings.llm_base_url,
    api_key=_settings.llm_api_key,
    timeout_seconds=_settings.llm_timeout_seconds,
    retries=_settings.llm_retries,
)
_embedding_provider = OpenAICompatibleEmbeddingProvider(
    model=_settings.embedding_model,
    base_url=_settings.resolved_embedding_base_url,
    api_key=_settings.resolved_embedding_api_key,
    dimensions=_settings.embedding_dimensions,
)
_llm_providers: list[LLMProvider] = [_llm_provider]


@router.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if not _settings.llm_api_key and not _settings.resolved_embedding_api_key:
        raise HTTPException(
            status_code=503,
            detail="Embedding provider is not configured (set AI_EMBEDDING_API_KEY or AI_LLM_API_KEY)",
        )
    result = _embedding_provider.embed(req.texts)
    return EmbedResponse(
        embeddings=result.embeddings,
        model=result.model,
        dimensions=result.dimensions,
        usage=result.usage,
    )


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    if not _settings.llm_api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM provider is not configured (set AI_LLM_API_KEY)",
        )
    result = _llm_provider.generate(
        GenerationRequest(
            prompt=req.prompt,
            model=req.model or _settings.llm_model,
            system_prompt=req.system_prompt,
            temperature=req.temperature
            if req.temperature is not None
            else _settings.llm_temperature,
            max_tokens=req.max_tokens or _settings.llm_max_tokens,
        )
    )
    return GenerateResponse(
        text=result.text,
        model=result.model,
        model_version=result.model_version,
        usage=result.usage,
    )


@router.get("/gateway", response_model=GatewayStatus)
def gateway_status() -> GatewayStatus:
    llm_configured = bool(_settings.llm_api_key)
    embedding_configured = bool(_settings.resolved_embedding_api_key)
    return GatewayStatus(
        llm_provider=_llm_provider.name,
        embedding_provider=_embedding_provider.name,
        providers=[
            ProviderInfo(
                name=_llm_provider.name,
                kind="llm",
                model=_llm_provider.model,
                configured=llm_configured,
            ),
            ProviderInfo(
                name=_embedding_provider.name,
                kind="embedding",
                model=_embedding_provider.model,
                configured=embedding_configured,
            ),
        ],
    )