import { useState, useCallback, useRef } from "react";
import { streamChat } from "../api/chat";

export function useChat() {
  const [messages, setMessages]   = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [provider, setProvider]   = useState(null);  // null = use backend default
  const [modelInfo, setModelInfo] = useState(null);
  const [error, setError]         = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;
    setError(null);

    const userMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);

    // placeholder assistant message we'll fill via streaming
    const assistantId = Date.now();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setStreaming(true);

    abortRef.current = streamChat({
      messages: nextHistory,
      provider,
      onMeta: (info) => setModelInfo(info),
      onDelta: (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + chunk } : m
        ));
      },
      onDone: () => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, streaming: false } : m
        ));
        setStreaming(false);
      },
      onError: (msg) => {
        setError(msg);
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        setStreaming(false);
      },
    });
  }, [messages, streaming, provider]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setError(null);
  }, []);

  return { messages, streaming, provider, setProvider, modelInfo, error, setError, sendMessage, cancel, clear };
}
