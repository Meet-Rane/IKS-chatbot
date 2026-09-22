from pydantic import BaseModel, Field
from typing import Literal, Optional

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    stream: bool = True
    max_tokens: Optional[int] = None
    provider: Optional[Literal["anthropic", "openai", "gemini", "ollama"]] = None  # override .env

class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    provider: str
    model: str

class ProviderInfo(BaseModel):
    provider: str
    model: str
    available: bool
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    version: str = "1.0.0"
