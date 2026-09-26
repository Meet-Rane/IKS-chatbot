"""
Flexible AI service — routes to Anthropic, OpenAI, Gemini, or Ollama
based on PROVIDER env var (or per-request override).
Streaming is handled via Server-Sent Events in the router.
"""

import json
import asyncio
import logging
from contextlib import aclosing
from typing import AsyncIterator, Optional
from app.core.config import settings
from app.core.prompts import IKS_SYSTEM_PROMPT
from app.models.chat import Message

logger = logging.getLogger(__name__)


# ── Anthropic ──────────────────────────────────────────────────────
async def _stream_anthropic(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        async with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=IKS_SYSTEM_PROMPT,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        ) as stream:
            async for text in stream.text_stream:
                yield text
    finally:
        await client.close()


# ── OpenAI-compatible endpoints ───────────────────────────────────
async def _stream_openai_compatible(
    api_key: str,
    base_url: str,
    model: str,
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    turns = [{"role": "system", "content": IKS_SYSTEM_PROMPT}]
    turns += [{"role": m.role, "content": m.content} for m in messages]

    async with AsyncOpenAI(api_key=api_key, base_url=base_url) as client:
        stream = await client.chat.completions.create(
            model=model,
            messages=turns,
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


async def _stream_openai(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    async for chunk in _stream_openai_compatible(
        settings.openai_api_key,
        settings.openai_base_url,
        settings.openai_model,
        messages,
        max_tokens,
    ):
        yield chunk


class IncompleteResponseError(RuntimeError):
    """The provider ended without completing its answer."""


async def _stream_gemini(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    # Resume a dropped connection or token-limit finish once, preserving text.
    turns = list(messages)
    for continuation in range(2):
        answer = ""
        try:
            async with aclosing(_stream_gemini_once(turns, max_tokens)) as stream:
                async for text in stream:
                    answer += text
                    yield text
            return
        except IncompleteResponseError:
            if continuation or not answer:
                raise
            turns.extend([
                Message(role="assistant", content=answer),
                Message(role="user", content="Continue exactly where the previous answer ended. Do not repeat it. Finish the answer concisely."),
            ])
            yield "\n\n"


async def _stream_gemini_once(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    import httpx

    gemini_key = settings.gemini_api_key or settings.openai_api_key
    if not _is_valid_gemini_key(gemini_key):
        raise ValueError(
            "Invalid Gemini API key. Set GEMINI_API_KEY in backend/.env to a valid key from Google AI Studio."
        )

    contents = [
        {
            "role": "model" if message.role == "assistant" else "user",
            "parts": [{"text": message.content}],
        }
        for message in messages
    ]
    models_to_try = [settings.gemini_model]
    if settings.gemini_fallback_model and settings.gemini_fallback_model != settings.gemini_model:
        models_to_try.append(settings.gemini_fallback_model)

    last_error: Optional[Exception] = None
    timeout = httpx.Timeout(
        connect=10.0,
        read=max(1.0, settings.ai_stream_idle_timeout_seconds),
        write=10.0,
        pool=10.0,
    )
    base_url = settings.gemini_base_url.rstrip("/")
    if base_url.endswith("/openai"):
        base_url = base_url.removesuffix("/openai")

    async with httpx.AsyncClient(timeout=timeout) as client:
        for model_name in models_to_try:
            for attempt in range(1, max(1, settings.gemini_retry_attempts) + 1):
                stream_started = False
                try:
                    payload = {
                        "systemInstruction": {"parts": [{"text": IKS_SYSTEM_PROMPT}]},
                        "contents": contents,
                        "generationConfig": {
                            "maxOutputTokens": max_tokens,
                            "thinkingConfig": {
                                "thinkingLevel": settings.gemini_thinking_level,
                            },
                        },
                    }
                    # Buffer at the provider boundary. Some upstream SSE connections
                    # end without a finish signal; JSON responses are atomic and validated.
                    url = f"{base_url}/models/{model_name}:generateContent"
                    response = await client.post(
                        url,
                        headers={"x-goog-api-key": gemini_key},
                        json=payload,
                    )
                    response.raise_for_status()
                    data = response.json()
                    if data.get("error"):
                        raise RuntimeError("The AI service could not complete the request. Please try again.")
                    if data.get("promptFeedback", {}).get("blockReason"):
                        raise RuntimeError("The AI service could not answer this question. Try rephrasing it.")
                    candidates = data.get("candidates", [])
                    candidate = candidates[0] if candidates else {}
                    finish_reason = candidate.get("finishReason")
                    parts = candidate.get("content", {}).get("parts", [])
                    answer = "".join(part.get("text", "") for part in parts if not part.get("thought"))
                    if finish_reason in ("STOP", "MAX_TOKENS") and answer:
                        stream_started = True
                        yield answer

                    if finish_reason == "MAX_TOKENS":
                        raise IncompleteResponseError(
                            "The answer reached its length limit. Use Continue answer to read more."
                        )
                    if finish_reason != "STOP":
                        logger.warning("Gemini incomplete finish_reason=%s text_started=%s", finish_reason, stream_started)
                        if finish_reason is None:
                            raise IncompleteResponseError(
                                "The provider connection closed early. Continue the saved answer or try again."
                            )
                        raise RuntimeError(
                            "The AI service could not complete this answer. Try rephrasing the question."
                        )
                    if not stream_started:
                        raise RuntimeError("Gemini returned an empty response. Please try again.")
                    return

                except Exception as e:
                    if stream_started:
                        if isinstance(e, (httpx.ReadError, httpx.ReadTimeout, httpx.RemoteProtocolError)):
                            raise IncompleteResponseError("The connection was interrupted. Continue the saved answer.") from e
                        # Never append a fresh fallback answer after partial output.
                        raise
                    last_error = e
                    transient = _is_transient_gemini_error(e)
                    if stream_started or not transient or attempt >= max(1, settings.gemini_retry_attempts):
                        break

                    backoff = settings.gemini_retry_backoff_seconds * attempt
                    await asyncio.sleep(backoff)

        if last_error:
            if isinstance(last_error, httpx.HTTPStatusError):
                status = last_error.response.status_code
                if status == 429:
                    raise RuntimeError("The AI service is busy or its quota is exhausted. Please try again shortly.") from last_error
                if status in (401, 403):
                    raise RuntimeError("The AI service rejected the API key. Check the backend configuration.") from last_error
                raise RuntimeError(f"The AI service returned an error ({status}). Please try again.") from last_error
            raise last_error


def _is_transient_gemini_error(error: Exception) -> bool:
    text = str(error).lower()
    error_type = type(error).__name__.lower()
    return (
        "503" in text
        or "429" in text
        or "502" in text
        or "504" in text
        or "unavailable" in text
        or "high demand" in text
        or "resource_exhausted" in text
        or "deadline exceeded" in text
        or "timeout" in text
        or "timeout" in error_type
        or "connecterror" in error_type
        or "remoteprotocolerror" in error_type
    )


def _is_valid_gemini_key(key: Optional[str]) -> bool:
    if not key:
        return False
    value = key.strip()
    if not value:
        return False
    lower = value.lower()
    if (
        value == "your_gemini_api_key_here"
        or "your_real_key" in lower
        or "paste" in lower
        or "example" in lower
    ):
        return False
    return value.startswith("AIza") or value.startswith("AQ.")


def _recent_messages(messages: list[Message]) -> list[Message]:
    """Keep long chats from making every new response progressively slower."""
    recent = messages[-max(1, settings.chat_history_max_messages):]
    remaining = max(1, settings.chat_history_max_characters)
    selected: list[Message] = []

    for message in reversed(recent):
        if remaining <= 0:
            break
        content = message.content[-remaining:]
        selected.append(Message(role=message.role, content=content))
        remaining -= len(content)

    selected.reverse()
    # Anthropic requires a user turn at the start of the retained conversation.
    while selected and selected[0].role != "user":
        selected.pop(0)
    return selected


async def _stream_with_timeouts(stream: AsyncIterator[str]) -> AsyncIterator[str]:
    """Keep the provider connection in one task; time out queue reads, not HTTP iteration."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=16)

    async def produce():
        try:
            async with aclosing(stream):
                async for chunk in stream:
                    await queue.put(("delta", chunk))
            await queue.put(("done", None))
        except Exception as error:
            await queue.put(("error", error))

    producer = asyncio.create_task(produce())
    timeout = max(1.0, settings.ai_first_token_timeout_seconds)
    first = True
    try:
        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), timeout=timeout)
            except asyncio.TimeoutError as exc:
                phase = "start responding" if first else "continue responding"
                raise TimeoutError(
                    f"The AI provider did not {phase} within {timeout:g} seconds. Please try again."
                ) from exc
            if kind == "done":
                return
            if kind == "error":
                raise value
            first = False
            timeout = max(1.0, settings.ai_stream_idle_timeout_seconds)
            yield value
    finally:
        producer.cancel()
        await asyncio.gather(producer, return_exceptions=True)


# ── Ollama (local) ─────────────────────────────────────────────────
async def _stream_ollama(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    import httpx

    turns = [{"role": "system", "content": IKS_SYSTEM_PROMPT}]
    turns += [{"role": m.role, "content": m.content} for m in messages]

    url = f"{settings.ollama_base_url}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": turns,
        "stream": True,
        "options": {"num_predict": max_tokens},
    }

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content


# ── Public API ─────────────────────────────────────────────────────
def get_provider_info(provider: Optional[str] = None) -> dict:
    p = provider or settings.provider
    model_map = {
        "anthropic": settings.anthropic_model,
        "openai": settings.openai_model,
        "gemini": settings.gemini_model,
        "ollama": settings.ollama_model,
    }
    return {"provider": p, "model": model_map.get(p, "unknown")}


async def stream_chat(
    messages: list[Message],
    provider: Optional[str] = None,
    max_tokens: Optional[int] = None,
) -> AsyncIterator[str]:
    p = provider or settings.provider
    tokens = max(1, min(max_tokens or settings.max_tokens, 8192))
    recent_messages = _recent_messages(messages)

    if p == "anthropic":
        stream = _stream_anthropic(recent_messages, tokens)
    elif p == "openai":
        stream = _stream_openai(recent_messages, tokens)
    elif p == "gemini":
        stream = _stream_gemini(recent_messages, tokens)
    elif p == "ollama":
        stream = _stream_ollama(recent_messages, tokens)
    else:
        raise ValueError(f"Unknown provider: {p}")

    async with aclosing(_stream_with_timeouts(stream)) as guarded:
        async for chunk in guarded:
            yield chunk
