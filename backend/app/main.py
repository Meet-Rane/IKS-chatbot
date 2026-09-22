from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.chat import router as chat_router

app = FastAPI(
    title="IKS Archive API",
    description="Indian Knowledge Systems — AI-powered Q&A backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1", tags=["chat"])

@app.get("/")
async def root():
    return {"message": "IKS Archive API", "docs": "/docs", "provider": settings.provider}
