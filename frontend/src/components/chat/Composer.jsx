import { useRef, useEffect } from "react";
import styles from "./Composer.module.css";

export function Composer({ onSend, streaming, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!streaming) ref.current?.focus();
  }, [streaming]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 130) + "px";
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const text = ref.current?.value.trim();
    if (!text || streaming) return;
    ref.current.value = "";
    ref.current.style.height = "auto";
    onSend(text);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <textarea
          ref={ref}
          className={styles.input}
          rows={1}
          placeholder="Ask about Vedic sciences, philosophy, mathematics, Ayurveda…"
          onKeyDown={handleKey}
          onInput={resize}
          disabled={false}
        />
        {streaming ? (
          <button className={`${styles.sendBtn} ${styles.cancel}`} onClick={onCancel} title="Cancel">■</button>
        ) : (
          <button className={styles.sendBtn} onClick={submit} title="Send">↑</button>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.hint}>
          <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for new line
        </span>
        <span className={styles.hint}>IKS Archive · AI-powered</span>
      </div>
    </div>
  );
}
