import { useState, useCallback, useRef, useEffect } from "react";
import { streamChat } from "../api/chat";

const STORE = "iks-chat-v2";
function loadMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(saved) ? saved.filter(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-60) : [];
  } catch { return []; }
}
export function useChat() {
  const [messages, setMessages] = useState(loadMessages);
  const [streaming, setStreaming] = useState(false);
  const [provider, setProvider] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [error, setError] = useState(null);
  const [statusText, setStatusText] = useState("");
  const active = useRef(null);
  const history = useRef(messages);
  history.current = messages;

  useEffect(() => {
    if (!streaming) {
      try { localStorage.setItem(STORE, JSON.stringify(messages.slice(-60))); } catch {}
    }
  }, [messages, streaming]);
  useEffect(() => () => {
    const request = active.current;
    active.current = null;
    request?.controller?.abort();
    clearTimeout(request?.timer);
  }, []);

  const start = useCallback(turns => {
    if (active.current) return;
    const id = crypto.randomUUID();
    const request = { id, text: "", timer: null, controller: null };
    active.current = request;
    setError(null);
    setStatusText("Preparing your answer…");
    setStreaming(true);
    setMessages([...turns, { id, role: "assistant", content: "", streaming: true }]);
    const flush = () => {
      clearTimeout(request.timer);
      request.timer = null;
      if (active.current !== request) return;
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: request.text } : m));
    };
    const finish = failure => {
      if (active.current !== request) return;
      clearTimeout(request.timer);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: request.text, streaming: false, interrupted: !!failure } : m));
      active.current = null;
      setStreaming(false);
      setStatusText("");
      setError(failure || null);
    };
    request.controller = streamChat({
      messages: turns.filter(m => m.content).map(({ role, content }) => ({ role, content })),
      provider,
      onMeta: info => { if (active.current === request) setModelInfo(info); },
      onStatus: text => { if (active.current === request) setStatusText(text); },
      onDelta: text => {
        if (active.current !== request) return;
        request.text += text;
        setStatusText("Writing…");
        if (!request.timer) request.timer = setTimeout(flush, 40);
      },
      onDone: () => finish(),
      onError: finish,
    });
  }, [provider]);
  const sendMessage = useCallback(text => {
    if (!text.trim() || active.current) return;
    start([...history.current.filter(m => m.content), { id: crypto.randomUUID(), role: "user", content: text.trim() }]);
  }, [start]);
  const retry = useCallback(() => {
    const turns = [...history.current];
    while (turns.length && turns.at(-1).role !== "user") turns.pop();
    if (turns.length) start(turns);
  }, [start]);
  const cancel = useCallback(() => {
    const request = active.current;
    if (!request) return;
    active.current = null;
    request.controller?.abort();
    clearTimeout(request.timer);
    setMessages(prev => prev.map(m => m.id === request.id ? { ...m, content: request.text, streaming: false, interrupted: true } : m));
    setStreaming(false);
    setStatusText("");
  }, []);
  const clear = useCallback(() => { cancel(); setMessages([]); setError(null); }, [cancel]);
  return { messages, streaming, provider, setProvider, modelInfo, error, setError, statusText, sendMessage, retry, cancel, clear };
}
