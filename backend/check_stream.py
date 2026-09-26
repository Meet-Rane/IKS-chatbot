"""Live smoke check: reports timing and completion, never credentials."""
import asyncio
import time
from app.models.chat import Message
from app.services.ai_service import stream_chat


async def main():
    history = []
    for question in (
        "What is the padapatha technique? Explain with a simple example.",
        "Tell me about IKS.",
    ):
        history.append(Message(role="user", content=question))
        started = time.perf_counter()
        first = None
        chunks = []
        try:
            async for chunk in stream_chat(history):
                if first is None:
                    first = time.perf_counter() - started
                chunks.append(chunk)
            answer = "".join(chunks)
            print(f"PASS first_text={first:.2f}s total={time.perf_counter()-started:.2f}s chunks={len(chunks)} characters={len(answer)}", flush=True)
            print("Ending:", answer[-160:].encode("ascii", "replace").decode(), flush=True)
            history.append(Message(role="assistant", content=answer))
        except Exception as error:
            print(f"FAIL {type(error).__name__}: {error}", flush=True)
            raise


if __name__ == "__main__":
    asyncio.run(main())
