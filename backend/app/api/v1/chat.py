from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

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
    gemini_key = (settings.gemini_api_key or settings.openai_api_key or "").strip()
    gemini_configured = bool(
        gemini_key
        and gemini_key != "your_gemini_api_key_here"
        and (gemini_key.startswith("AIza") or gemini_key.startswith("AQ."))
    )

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
                "configured": gemini_configured,
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

        stream = stream_chat(
            request.messages,
            provider=request.provider,
            max_tokens=request.max_tokens,
        )
        iterator = stream.__aiter__()
        pending = asyncio.create_task(anext(iterator))
        started = asyncio.get_running_loop().time()
        received_text = False

        try:
            while True:
                elapsed = asyncio.get_running_loop().time() - started
                if elapsed >= 180:
                    raise TimeoutError("This answer is taking too long. Retry or continue the saved response.")
                done, _ = await asyncio.wait(
                    {pending},
                    timeout=min(max(1.0, settings.sse_heartbeat_seconds), 180 - elapsed),
                )
                if not done:
                    status = "Still working on your answer…" if not received_text else "Waiting for the next part…"
                    yield f"data: {json.dumps({'type': 'status', 'text': status})}\n\n"
                    continue

                try:
                    chunk = pending.result()
                except StopAsyncIteration:
                    break

                payload = json.dumps({"type": "delta", "text": chunk})
                if not received_text:
                    logger.info("chat provider=%s first_text_seconds=%.2f", info["provider"], asyncio.get_running_loop().time() - started)
                received_text = True
                yield f"data: {payload}\n\n"
                pending = asyncio.create_task(anext(iterator))

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            err = json.dumps({"type": "error", "text": str(e) or "The AI connection was interrupted. Please try again."})
            yield f"data: {err}\n\n"
        finally:
            pending.cancel()
            await asyncio.gather(pending, return_exceptions=True)
            await iterator.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx: disable buffering
        },
    )
