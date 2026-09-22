const BASE = import.meta.env.VITE_API_URL || "";

export async function fetchHealth() {
  const res = await fetch(`${BASE}/api/v1/health`);
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}

export async function fetchProviders() {
  const res = await fetch(`${BASE}/api/v1/providers`);
  return res.json();
}

/**
 * Stream a chat request via SSE.
 * onDelta(text)  — called for each chunk
 * onMeta({provider, model}) — called once at start
 * onDone()       — called when stream ends
 * onError(msg)   — called on error
 * Returns abort controller so caller can cancel.
 */
export function streamChat({ messages, provider = null, onDelta, onMeta, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, provider, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        onError?.(err.detail || "Request failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);
            if (event.type === "meta") onMeta?.({ provider: event.provider, model: event.model });
            else if (event.type === "delta") onDelta?.(event.text);
            else if (event.type === "done") onDone?.();
            else if (event.type === "error") onError?.(event.text);
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err.message);
    }
  })();

  return controller;
}
