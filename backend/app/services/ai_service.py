"""
Flexible AI service — routes to Anthropic, OpenAI, Gemini, or Ollama
based on PROVIDER env var (or per-request override).
Streaming is handled via Server-Sent Events in the router.
"""

import json
import asyncio
from typing import AsyncIterator, Optional
from app.core.config import settings
from app.core.prompts import IKS_SYSTEM_PROMPT
from app.models.chat import Message


# ── Anthropic ──────────────────────────────────────────────────────
async def _stream_anthropic(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=IKS_SYSTEM_PROMPT,
        messages=[{"role": m.role, "content": m.content} for m in messages],
    ) as stream:
        async for text in stream.text_stream:
            yield text


# ── OpenAI-compatible endpoints ───────────────────────────────────
async def _stream_openai_compatible(
    api_key: str,
    base_url: str,
    model: str,
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    turns = [{"role": "system", "content": IKS_SYSTEM_PROMPT}]
    turns += [{"role": m.role, "content": m.content} for m in messages]

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


async def _stream_gemini(
    messages: list[Message],
    max_tokens: int,
) -> AsyncIterator[str]:
    from google import genai

    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")

    prompt_lines = [IKS_SYSTEM_PROMPT, "", "Conversation:"]
    for message in messages:
        prompt_lines.append(f"{message.role.upper()}: {message.content}")
    prompt_lines.append("ASSISTANT:")
    prompt = "\n".join(prompt_lines)

    client = genai.Client(api_key=settings.gemini_api_key)
    stream = await asyncio.to_thread(
        client.models.generate_content_stream,
        model=settings.gemini_model,
        contents=prompt,
        config={"max_output_tokens": max_tokens},
    )

    for chunk in stream:
        text = getattr(chunk, "text", None)
        if text:
            yield text


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
    tokens = min(max_tokens or settings.max_tokens, 768)

    if p == "anthropic":
        async for chunk in _stream_anthropic(messages, tokens):
            yield chunk
    elif p == "openai":
        async for chunk in _stream_openai(messages, tokens):
            yield chunk
    elif p == "gemini":
        async for chunk in _stream_gemini(messages, tokens):
            yield chunk
    elif p == "ollama":
        async for chunk in _stream_ollama(messages, tokens):
            yield chunk
    else:
        raise ValueError(f"Unknown provider: {p}")
