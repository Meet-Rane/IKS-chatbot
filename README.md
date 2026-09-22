# IKS Archive — Indian Knowledge Systems Chatbot

Full-stack AI chatbot for Indian Knowledge Systems (IKS) subject.
Beige dossier UI · FastAPI backend · React+Vite frontend · Flexible AI provider.

## Project Structure

```
iks/
├── backend/                   # FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/chat.py     # Routes: /health /providers /chat /chat/stream
│   │   ├── core/
│   │   │   ├── config.py      # Pydantic settings from .env
│   │   │   └── prompts.py     # IKS system prompt
│   │   ├── models/chat.py     # Request/response Pydantic models
│   │   └── services/
│   │       └── ai_service.py  # Anthropic | OpenAI | Ollama router
│   ├── main.py
│   ├── run.py
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                  # React + Vite frontend
    ├── src/
    │   ├── api/chat.js        # Fetch + SSE streaming client
    │   ├── hooks/
    │   │   ├── useChat.js     # Chat state + streaming logic
    │   │   └── useHealth.js   # Backend health polling
    │   ├── components/
    │   │   ├── chat/          # MessageBubble, ThinkingBubble, Composer, EmptyState, CaseStrip
    │   │   └── ui/            # Topbar
    │   ├── pages/ChatPage.jsx
    │   ├── styles/global.css  # CSS custom properties (dossier theme)
    │   └── App.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## Setup

### 1. Backend

```bash
cd backend

# Copy and fill in your API key
cp .env.example .env
# Edit .env — set PROVIDER and the matching API key

# Create venv and install
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt


# Run
python run.py
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend

# Install deps
npm install

# (optional) copy env if you need a different API URL
cp .env.example .env

# Dev server
npm run dev
# → http://localhost:5173
```

## Switching AI Provider

Edit `backend/.env`:

```env
# Use Claude (default)
PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Use OpenAI
PROVIDER=openai
OPENAI_API_KEY=sk-...

# Use Gemini
PROVIDER=gemini
GEMINI_API_KEY=AIza...

# Use Ollama (local, no key needed — install Ollama first)
PROVIDER=ollama
OLLAMA_MODEL=llama3
```

You can also switch provider per-request from the UI dropdown in the topbar — it sends the selection to the backend, which overrides the .env for that request.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Backend + provider status |
| GET | `/api/v1/providers` | All configured providers |
| POST | `/api/v1/chat` | Full response (non-streaming) |
| POST | `/api/v1/chat/stream` | SSE streaming response |

### SSE Event format (streaming)
```json
data: {"type": "meta", "provider": "anthropic", "model": "claude-sonnet-4-6"}
data: {"type": "delta", "text": "chunk of text..."}
data: {"type": "done"}
data: {"type": "error", "text": "error message"}
```
