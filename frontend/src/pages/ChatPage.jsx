import { useEffect, useRef } from "react";
import { useChat } from "../hooks/useChat";
import { useHealth } from "../hooks/useHealth";
import { Topbar } from "../components/ui/Topbar";
import { CaseStrip } from "../components/chat/CaseStrip";
import { EmptyState } from "../components/chat/EmptyState";
import { MessageBubble } from "../components/chat/MessageBubble";
import { ThinkingBubble } from "../components/chat/ThinkingBubble";
import { Composer } from "../components/chat/Composer";
import styles from "./ChatPage.module.css";

export default function ChatPage() {
  const { status, health, providers } = useHealth();
  const {
    messages, streaming, provider, setProvider,
    modelInfo, error, setError, sendMessage, cancel, clear,
  } = useChat();

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className={styles.shell}>
      <Topbar
        status={status}
        modelInfo={modelInfo}
        provider={provider}
        setProvider={setProvider}
        providers={providers}
        onClear={clear}
      />

      <CaseStrip />

      <div className={styles.messages}>
        {messages.length === 0 && !streaming ? (
          <EmptyState onSuggest={sendMessage} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id ?? i} message={msg} />
            ))}
            {streaming && messages[messages.length - 1]?.streaming === false && (
              <ThinkingBubble />
            )}
          </>
        )}

        {error && (
          <div className={styles.errorBar}>
            ⚠ {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <Composer onSend={sendMessage} streaming={streaming} onCancel={cancel} />
    </div>
  );
}
