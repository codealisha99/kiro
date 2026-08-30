from typing import Any

from fastapi import FastAPI

from app.health import router as health_router
from app.routes import router as ai_router

app = FastAPI(
    title="Company Brain AI Service",
    description="LLM gateway + inference for Company Brain",
    version="0.1.0",
)

app.include_router(health_router, prefix="/admin")
app.include_router(ai_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "company-brain-ai", "status": "ok"}