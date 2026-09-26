const BASE = import.meta.env?.VITE_API_URL || "";

export async function fetchHealth() {
  const res = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}
export async function fetchProviders() {
  const res = await fetch(`${BASE}/api/v1/providers`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Cannot load providers");
  return res.json();
}

// Parse SSE events independently of network chunk boundaries.
export async function readEvents(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", data = [];
  const dispatch = () => {
    if (!data.length) return false;
    const event = JSON.parse(data.join("\n"));
    data = [];
    onEvent(event);
    return event.type === "done" || event.type === "error";
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (!line) {
          if (dispatch()) return;
        } else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (done) {
        if (buffer.startsWith("data:")) data.push(buffer.slice(5).trimStart());
        if (dispatch()) return;
        throw new Error("The connection was interrupted. Your partial answer is saved; retry or continue it.");
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function streamChat({ messages, provider = null, onDelta, onMeta, onStatus, onDone, onError }) {
  const controller = new AbortController();
  let terminal = false, timedOut = false, timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
  };
  arm();
  (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages, provider }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(typeof error.detail === "string" ? error.detail : `Request failed (${res.status}).`);
      }
      if (!res.body) throw new Error("Streaming is unavailable in this browser.");
      await readEvents(res.body, event => {
        if (controller.signal.aborted || terminal) return;
        if (event.type === "meta") onMeta?.(event);
        else if (event.type === "status") onStatus?.(event.text);
        else if (event.type === "delta") { arm(); onDelta?.(event.text); }
        else if (event.type === "done") { terminal = true; onDone?.(); }
        else if (event.type === "error") { terminal = true; onError?.(event.text); }
      });
    } catch (err) {
      if (!terminal && (!controller.signal.aborted || timedOut)) {
        terminal = true;
        onError?.(timedOut ? "The answer stopped arriving. Retry or continue the saved response." : err.message);
      }
    } finally { clearTimeout(timer); }
  })();
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller;
}
