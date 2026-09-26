import asyncio
import json
import unittest
from unittest.mock import patch

import httpx
from app.core.config import settings
from app.models.chat import Message, ChatRequest
from app.services import ai_service
from app.api.v1.chat import chat_stream


def event(text, finish=None):
    candidate = {"content": {"parts": [{"text": text}]}}
    if finish:
        candidate["finishReason"] = finish
    return json.dumps({"candidates": [candidate]})


class StreamingTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        api_key = patch.object(settings, "gemini_api_key", "AIza-test-key")
        api_key.start()
        self.addCleanup(api_key.stop)

    def mock_client(self, handler):
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        return patch("httpx.AsyncClient", return_value=client)

    async def test_complete_answer_requires_stop(self):
        with self.mock_client(lambda req: httpx.Response(200, text=event("Complete.", "STOP"))):
            result = [t async for t in ai_service._stream_gemini_once([Message(role="user", content="hello")], 4096)]
        self.assertEqual(result, ["Complete."])

    async def test_premature_eof_does_not_succeed_or_restart(self):
        calls = []
        def respond(req):
            calls.append(req)
            return httpx.Response(200, text=event("Partial"))
        with self.mock_client(respond), patch.object(settings, "gemini_fallback_model", "fallback"):
            chunks = []
            with self.assertRaisesRegex(ai_service.IncompleteResponseError, "closed early"):
                async for text in ai_service._stream_gemini_once([Message(role="user", content="hello")], 4096):
                    chunks.append(text)
        self.assertEqual(chunks, [])
        self.assertLessEqual(len(calls), 2)

    async def test_token_limit_continues_once(self):
        calls = []
        async def fake(turns, tokens):
            calls.append(turns)
            yield "First" if len(calls) == 1 else "rest."
            if len(calls) == 1:
                raise ai_service.IncompleteResponseError()
        with patch.object(ai_service, "_stream_gemini_once", fake):
            result = "".join([t async for t in ai_service._stream_gemini([Message(role="user", content="hello")], 4096)])
        self.assertEqual(result, "First\n\nrest.")
        self.assertEqual(calls[1][-2].content, "First")

    async def test_router_error_is_terminal_not_done(self):
        async def broken(*args, **kwargs):
            yield "Partial"
            raise RuntimeError("Connection lost")
        with patch("app.api.v1.chat.stream_chat", broken):
            response = await chat_stream(ChatRequest(messages=[Message(role="user", content="hello")]))
            events = [json.loads(chunk[6:]) async for chunk in response.body_iterator]
        self.assertEqual([e["type"] for e in events], ["meta", "delta", "error"])

    async def test_disconnect_closes_provider(self):
        closed = asyncio.Event()
        async def provider(*args, **kwargs):
            try:
                yield "First"
                await asyncio.sleep(60)
            finally:
                closed.set()
        with patch("app.api.v1.chat.stream_chat", provider):
            response = await chat_stream(ChatRequest(messages=[Message(role="user", content="hello")]))
            stream = response.body_iterator
            await anext(stream)
            await anext(stream)
            await stream.aclose()
        self.assertTrue(closed.is_set())


if __name__ == "__main__":
    unittest.main()
