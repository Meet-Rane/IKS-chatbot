# IKS Archive — project and viva guide

This guide describes the code currently in this repository, not an imagined production system. The application is an AI-assisted question-answering chatbot about Indian Knowledge Systems (IKS). The frontend is a React single-page app; a Python FastAPI backend receives questions, calls a configured AI provider, and returns the answer. The current local configuration uses Gemini. This is a prototype for learning and exploration, not a verified scholarly database.

## A 30-second introduction

“IKS Archive helps a student ask natural-language questions about Indian Knowledge Systems, such as philosophy, mathematics, medicine, linguistics, and the arts. I built a React interface with chat history, provider status, retry, cancel, and continuation controls. A FastAPI backend validates requests, applies an IKS-specific system prompt, calls a configurable AI provider, and sends completion or error events to the browser. I also added timeout handling and tests for the failures we saw: slow first responses and answers stopping midway.”

## Problem, objective, scope

The problem is that introductory information on IKS is spread across many subjects and terms; a beginner may not know what to search for. The objective is a simple conversational entry point that explains terms and provides contextual answers. The scope is question answering through a general-purpose model prompted for IKS. It does **not** ingest manuscripts, search a trusted corpus, validate historical claims, or guarantee authentic citations. Keep this distinction clear in a viva.

## Technology stack

| Layer | Implemented technology | Why it is here |
| --- | --- | --- |
| User interface | React 18, Vite 5, CSS, lucide-react | Component-driven UI, local development/build, responsive design and icons |
| API | Python, FastAPI, Pydantic, Uvicorn | Async HTTP routes, request validation, API documentation, development server |
| AI integration | `httpx` for current Gemini path; provider adapters for Anthropic, OpenAI, Ollama | Calls the selected model without exposing the key to the browser |
| Delivery | Server-Sent Events (SSE) over `fetch` | Sends metadata, progress, answer, and an explicit terminal event |
| Local persistence | Browser `localStorage` | Remembers this browser's recent chat; no database or account |
| Testing | Python `unittest` and Node test runner | Verifies completion and interruption behavior |

Vite runs on port **5173** and proxies `/api` in development to FastAPI on port **8000**. The backend API prefix is `/api/v1`. The backend serves interactive API docs at `/docs` when running.

## Architecture and exact answer flow

```text
User types question
    ↓
React ChatPage → useChat hook → frontend API client
    ↓ POST /api/v1/chat/stream, JSON message history
FastAPI route → Pydantic ChatRequest validation
    ↓
AI service → recent-history limit + IKS system prompt + selected provider
    ↓
Provider response → backend checks completion or error
    ↓ SSE: meta / status / delta / done OR error
Browser SSE parser → React state → rendered answer and localStorage
```

The browser sends `messages` with `role` (`user` or `assistant`) and `content`, plus an optional `provider`. The frontend owns the currently visible conversation and sends it on each question. The backend does not keep a session. Before provider invocation it retains at most the configured last 20 messages and 24,000 characters, to limit latency and cost. This may remove earlier context. The backend system prompt requests direct explanations, relevant source-text names, and acknowledgement of scholarly debate. A prompt guides the model; it does not train it or verify its output.

### API contract

| Route | Purpose |
| --- | --- |
| `GET /api/v1/health` | Reports that backend code is reachable and returns configured provider/model; it does not test the provider connection |
| `GET /api/v1/providers` | Lists provider configuration flags and model names; an Ollama “configured” flag does not prove the local Ollama server is running |
| `POST /api/v1/chat` | Returns one JSON answer after generation finishes |
| `POST /api/v1/chat/stream` | Sends SSE events used by the UI |

Example request body: `{"messages":[{"role":"user","content":"What is Padapatha?"}],"provider":"gemini"}`. The streaming response carries JSON inside `data:` lines, separated by a blank line. Event types are `meta` (provider/model), `status` (heartbeat/progress), `delta` (answer text), `done` (successful completion), and `error` (failed completion). A plain network close without `done` or `error` is treated as an interrupted response, not as success.

### An important streaming nuance

SSE is the **backend-to-browser transport**. Anthropic, OpenAI, and Ollama adapters can forward provider text incrementally. The **current Gemini adapter does not stream tokens from Google**: it requests one complete JSON result using `generateContent`, checks the finish reason, then sends the validated answer as a `delta`. The UI may show progress heartbeats while waiting, but it cannot show Gemini's first word before the complete provider response arrives. This change favors completeness after the previous upstream stream sometimes ended midway. Do not say “Gemini tokens are streamed live” in the presentation.

For Gemini, `STOP` means a complete answer. `MAX_TOKENS` triggers one continuation attempt using the partial answer as context. Other incomplete finishes become explicit errors. Transient failures can be retried before user-visible answer text is sent; a new answer is not silently appended after partial output. The provider guard has first-response and idle limits (configured as 60 seconds). The API route has a 180-second overall limit, with 10-second SSE status heartbeats. The browser has a 90-second timer reset by received answer deltas, plus cancel/retry/continue controls. These limits prevent an indefinite “thinking” state, but cannot guarantee a provider will be fast or available.

## Frontend design

`src/main.jsx` mounts `App.jsx`, which renders `ChatPage.jsx`. `ChatPage` contains the visible interface and question composer. `useChat.js` owns messages, active request, errors, provider choice, cancel/retry/clear, and saves up to 60 messages under `iks-chat-v2` in `localStorage` after a request is no longer streaming. `useHealth.js` polls health/provider endpoints every 30 seconds. `src/api/chat.js` performs fetch calls and parses SSE across arbitrary network chunk boundaries, including split Unicode characters. `global.css` supplies the current responsive styling. Older files under `src/components` and `ChatPage.module.css` remain in the repository but are not the active UI path.

`localStorage` is convenient but device/browser-specific and readable by scripts on that origin. It is not a secure conversation database. “New chat” clears the UI's saved conversation in this browser. There is no login, multi-user separation on a server, or cross-device sync.

## Backend design

`app/main.py` constructs FastAPI, configures CORS, and mounts routes. `app/models/chat.py` contains Pydantic schemas. `app/api/v1/chat.py` implements health, providers, JSON chat, and SSE chat. `app/services/ai_service.py` limits history, selects the provider adapter, applies timeouts, and manages Gemini completion/retry logic. `app/core/prompts.py` contains the IKS system prompt. `app/core/config.py` reads settings from `.env.example` then `.env`; the latter is for local secrets and overrides examples. `run.py` starts Uvicorn. API keys remain on the backend. Do not show or commit the real `.env`.

CORS allows the configured frontend origin in the browser; it is **not** authentication. The Vite proxy connects the local development frontend to port 8000. When deploying separately, configure the frontend API URL and allowed origin for the real domains and use HTTPS.

## How to run and demo

The servers were stopped on request and are not assumed to be running now. To start them manually from separate PowerShell terminals, first configure `backend/.env` with a valid key (never put it on a slide):

```powershell
cd D:\iks\backend
python -m pip install -r requirements.txt
python run.py
```

```powershell
cd D:\iks\frontend
npm install
npm run dev
```

Open `http://localhost:5173/`. For a viva demo: show the initial UI; ask “What is Padapatha?”; point out provider/model and progress; show a complete answer; demonstrate New chat or a follow-up; show `/docs` if asked about APIs. Have screenshots as a backup because a live AI call depends on the key, quota, internet, and provider uptime. Never display secrets or the backend `.env` file.

## Testing and evidence

Backend `test_streaming.py` tests successful finish, premature finish errors, token-limit continuation, terminal SSE errors, and cleanup on disconnect. Frontend `src/api/chat.test.mjs` tests SSE splitting/Unicode/CRLF, unexpected EOF, a terminal event without a final newline, and provider error events. `check_stream.py` can smoke-test the live provider. Tests demonstrate specific behavior; they are not proof of factual accuracy of IKS answers. The prior implementation run passed the automated cases and two sample live prompts; rerun them before presenting if the environment or provider changes.

```powershell
cd D:\iks\backend
python -m unittest test_streaming.py
```

```powershell
cd D:\iks\frontend
node --test src/api/chat.test.mjs
npm run build
```

## Security, performance, and limitations

- The API key is read by the backend, not shipped in frontend JavaScript. The local `.env` is excluded from version control. Avoid logging secrets.
- Prompt injection or inaccurate output remains possible. “Source names” generated by the model are suggestions to check, **not** verified citations. For academic use, validate with a trusted text or scholar.
- No authentication, rate limiting, server-side audit log, moderation pipeline, or production observability is implemented. These would be needed for a public service.
- Health means the backend is alive; provider availability and quota are only known when a real provider request succeeds.
- The current Gemini completion strategy improves reliability but increases time to first visible answer compared with true token streaming. Provider latency, internet, and quota still matter.
- Retained history is truncated, so very old turns may no longer influence an answer. Browser storage is limited and local to one browser.
- IKS spans contested histories and living traditions. The bot should avoid presenting one interpretation as universally accepted.

Possible future work: a curated IKS corpus with retrieval-augmented generation (RAG), citation links to passages, evaluation by domain experts, source-quality labels, provider health probes, rate limits and accounts where appropriate, production deployment/monitoring, and accessibility/user testing. These are proposals, **not current features**.

## Three-minute presentation script

“My project is IKS Archive, an AI-assisted chatbot for introductory questions on Indian Knowledge Systems. I chose the topic because the field crosses philosophy, language, mathematics, medicine, and art, and a beginner needs a convenient entry point. The user types a question in a React interface. A FastAPI backend receives the conversation, validates it, keeps recent context, adds an IKS-focused system prompt, and sends it to a configured AI model. The current local provider is Gemini, while the service also contains adapters for Anthropic, OpenAI, and Ollama.

The frontend and backend communicate through a versioned REST API. The chat UI uses Server-Sent Events to receive metadata, progress, answer text, and a clear completion or error signal. In the active Gemini path, we request a complete answer from Google before delivering it; this deliberately avoids treating a prematurely ended upstream stream as a successful answer. The UI also provides retry, cancel, and continue controls, and saves recent chat locally in the browser.

I tested both the backend completion logic and the frontend SSE parser, especially split network chunks and interrupted connections. A key limitation is that this is prompt-based AI, not a source-verified knowledge base: it may produce mistakes or invented citations, so academic claims must be checked. My next step would be retrieval from a curated IKS corpus with passage-level citations and expert evaluation. The result is a usable learning interface with explicit handling of slow or incomplete responses.”

## Viva questions: short, defensible answers

1. **Why this project?** IKS covers many disciplines; natural-language chat makes introductory exploration easier, while clearly requiring verification for scholarship.
2. **Why React?** It gives reusable UI and stateful updates for messages, progress, retry, and responsive views.
3. **Why FastAPI?** Async request handling, Pydantic validation, straightforward streaming responses, and generated API docs.
4. **Why a backend rather than calling Gemini from React?** To keep the API key server-side, centralize provider selection, and enforce timeouts and response handling.
5. **What is SSE?** A one-way HTTP event stream from server to browser. Here, the browser sends a POST request and reads `data:` events from the response.
6. **Why not WebSockets?** The use case needs one-way answer delivery after a question; a full bidirectional persistent channel is unnecessary.
7. **Is the Gemini output truly token-streamed?** No. The backend waits for an atomic `generateContent` response, validates its finish reason, and then sends it over SSE to the UI.
8. **How do you detect a cut-off answer?** The backend checks Gemini's `finishReason`; the frontend requires `done` or `error`. A premature connection close is an error.
9. **What happens when the model is slow?** The UI receives status heartbeats; provider, request, and browser timers stop indefinite waiting and present retry/continue options.
10. **How is previous conversation used?** The browser sends prior turns with each request; the backend keeps only a recent message/character budget. There is no server session.
11. **What is prompt engineering here?** A fixed system instruction sets topic, tone, and citation guidance. It does not change model weights or supply verified documents.
12. **Is this RAG or fine-tuning?** Neither. There is no vector search or model training in this project.
13. **Can the bot cite real sources reliably?** It can mention texts, but the citations are not checked against a database; verify them independently.
14. **How do you secure the API key?** Keep it in backend `.env`, exclude that file from Git, and never expose it in browser code. Public deployment needs additional controls.
15. **What does the health endpoint prove?** It proves the backend responds. It does not prove that the provider key, quota, or network is healthy.
16. **Where are messages stored?** Up to 60 recent messages in this browser's `localStorage`, not in a server database.
17. **What are the main limitations?** AI factual reliability, provider latency/dependence, local-only history, lack of public-deployment controls, and no verified corpus.
18. **How would you improve academic reliability?** Build a curated source corpus, retrieve relevant passages, link citations, and evaluate answers with subject experts.
19. **What does a test prove?** It proves the tested behavior under the test's conditions; protocol tests do not prove historical or scientific truth.
20. **What if the live demo fails?** Show screenshots and the API/architecture, explain the provider dependency, and distinguish an external outage from the locally tested flow.

## Code locations to revise before viva

- Frontend entry and UI: `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/pages/ChatPage.jsx`, `frontend/src/styles/global.css`
- Chat state and networking: `frontend/src/hooks/useChat.js`, `frontend/src/hooks/useHealth.js`, `frontend/src/api/chat.js`
- Backend entry/routes/models: `backend/app/main.py`, `backend/app/api/v1/chat.py`, `backend/app/models/chat.py`
- Provider, prompt, configuration: `backend/app/services/ai_service.py`, `backend/app/core/prompts.py`, `backend/app/core/config.py`
- Tests: `backend/test_streaming.py`, `frontend/src/api/chat.test.mjs`
