import { useMemo } from "react";
import styles from "./MessageBubble.module.css";

let globalCount = 0;

function renderMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,  "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/`([^`]+)`/g,     "<code>$1</code>")
    .replace(/^> (.+)$/gm,     "<blockquote>$1</blockquote>")
    .split(/\n\n+/)
    .map(block => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<")) return block;
      const lines = block.split("\n").filter(Boolean);
      if (lines.every(l => /^[-•]\s/.test(l)))
        return "<ul>" + lines.map(l => `<li>${l.replace(/^[-•]\s/, "")}</li>`).join("") + "</ul>";
      if (lines.every(l => /^\d+\.\s/.test(l)))
        return "<ol>" + lines.map(l => `<li>${l.replace(/^\d+\.\s/, "")}</li>`).join("") + "</ol>";
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }) {
  const exhibit = useMemo(() => `EX-${String(++globalCount).padStart(3, "0")}`, []);
  const isUser  = message.role === "user";

  const html = isUser
    ? escapeHtml(message.content)
    : renderMarkdown(message.content);

  return (
    <div className={`${styles.message} ${isUser ? styles.user : styles.agent}`}>
      <div className={`${styles.avatar} ${isUser ? "" : styles.agentAvatar}`}>
        {isUser ? "YOU" : "IKS"}
      </div>

      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.sender}>{isUser ? "Researcher" : "IKS Archive"}</span>
          <span className={styles.time}>{ts()}</span>
        </div>

        <div
          className={styles.bubble}
          data-exhibit={exhibit}
          dangerouslySetInnerHTML={{ __html: html + (message.streaming ? '<span class="blink-cursor"></span>' : "") }}
        />
      </div>
    </div>
  );
}
