from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json

from app.models.chat import ChatRequest, ChatResponse, HealthResponse
from app.services.ai_service import stream_chat, get_provider_info
from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    info = get_provider_info()
    return HealthResponse(
        status="ok",
        provider=info["provider"],
        model=info["model"],
    )


@router.get("/providers")
async def list_providers():
    """Return which providers are configured."""
    return {
        "active": settings.provider,
        "available": {
            "anthropic": {
                "configured": bool(settings.anthropic_api_key and not settings.anthropic_api_key.startswith("sk-ant-...")),
                "model": settings.anthropic_model,
            },
            "openai": {
                "configured": bool(settings.openai_api_key and not settings.openai_api_key.startswith("sk-...")),
                "model": settings.openai_model,
            },
            "gemini": {
                "configured": bool(settings.gemini_api_key or settings.openai_api_key),
                "model": settings.gemini_model,
                "base_url": settings.gemini_base_url,
            },
            "ollama": {
                "configured": True,  # No key needed
                "model": settings.ollama_model,
                "base_url": settings.ollama_base_url,
            },
        },
    }


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Non-streaming chat — returns full response.
    Use /chat/stream for SSE streaming.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    info = get_provider_info(request.provider)
    full_text = ""

    try:
        async for chunk in stream_chat(
            request.messages,
            provider=request.provider,
            max_tokens=request.max_tokens,
        ):
            full_text += chunk
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return ChatResponse(
        content=full_text,
        provider=info["provider"],
        model=info["model"],
    )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Streaming chat via Server-Sent Events.
    Each SSE event is: data: {"type": "delta"|"done"|"error", "text": "..."}
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    info = get_provider_info(request.provider)

    async def event_generator():
        # Send provider info first
        meta = json.dumps({"type": "meta", "provider": info["provider"], "model": info["model"]})
        yield f"data: {meta}\n\n"

        try:
            async for chunk in stream_chat(
                request.messages,
                provider=request.provider,
                max_tokens=request.max_tokens,
            ):
                payload = json.dumps({"type": "delta", "text": chunk})
                yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            err = json.dumps({"type": "error", "text": str(e)})
            yield f"data: {err}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx: disable buffering
        },
    )
