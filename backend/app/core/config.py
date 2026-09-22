from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    # Provider
    provider: Literal["anthropic", "openai", "gemini", "ollama"] = "anthropic"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # OpenAI
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"

    # Gemini
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    gemini_model: str = "gemini-3.6-flash"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: str = "http://localhost:5173"
    debug: bool = True
    max_tokens: int = 768

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = (str(BASE_DIR / ".env"), str(BASE_DIR / ".env.example"))
        extra = "ignore"

settings = Settings()
