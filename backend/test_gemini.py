import asyncio
from app.models.chat import Message
from app.services.ai_service import stream_chat

async def main():
    messages = [Message(role="user", content="Hi!")]
    try:
        async for chunk in stream_chat(messages, provider="gemini"):
            print(chunk, end="", flush=True)
    except Exception as e:
        print(f"\nERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
