from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "company-brain-ai",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
