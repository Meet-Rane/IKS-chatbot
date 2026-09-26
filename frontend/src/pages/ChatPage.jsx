import { useEffect, useRef, useState, memo } from "react";
import { ArrowUp, Square, Plus, BookOpen, Sparkles, ArrowUpRight, Copy, Check, RotateCcw, Compass, Flower2, Menu, X, ChevronDown } from "lucide-react";
import { useChat } from "../hooks/useChat";
import { useHealth } from "../hooks/useHealth";

const topics = [
  { icon: BookOpen, title: "Wisdom & philosophy", text: "What are the six schools of Indian philosophy?", label: "Explore the six darshanas", tag: "PHILOSOPHY" },
  { icon: Compass, title: "Science & discovery", text: "What were Aryabhata’s contributions to mathematics?", label: "Meet the mind of Aryabhata", tag: "MATHEMATICS" },
  { icon: Flower2, title: "Language & tradition", text: "What is the padapatha technique? Explain with a simple example.", label: "Discover the art of Vedic recitation", tag: "VEDIC STUDIES" },
];
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> :
    part.startsWith("*") ? <em key={i}>{part.slice(1, -1)}</em> :
    part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part);
}
function Answer({ text }) {
  // React escapes model content; raw model HTML is never injected into the page.
  return text.split(/\n\n+/).map((block, i) => {
    if (/^#{1,4} /.test(block)) {
      const [heading, ...rest] = block.split("\n");
      return <section key={i}><h3>{inline(heading.replace(/^#+ /, ""))}</h3>{rest.length > 0 && <p>{inline(rest.join("\n"))}</p>}</section>;
    }
    const lines = block.split("\n");
    if (lines.every(l => /^\s*[-*•] /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•] /, ""))}</li>)}</ul>;
    if (lines.every(l => /^\s*\d+[.)] /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)] /, ""))}</li>)}</ol>;
    return <p key={i}>{inline(block)}</p>;
  });
}
const Message = memo(function Message({ message, statusText, onRetry, onContinue, canAct }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  };
  if (message.role === "user") return <div className="user-message">{message.content}</div>;
  return <article className="answer">
    <div className="answer-heading"><span className="mini-mark"><Flower2 size={17} /></span><strong>IKS</strong><span>Your knowledge companion</span></div>
    <div className="answer-body">
      {message.content ? <Answer text={message.content} /> : !message.streaming ? <p className="muted">No answer received. Try again below.</p> : null}
      {message.streaming && <div className="working" role="status"><span className="pulse-dot" />{statusText || "Preparing your answer…"}</div>}
    </div>
    {!message.streaming && <div className="message-actions">
      {message.content && <button onClick={copy} aria-label="Copy answer">{copied ? <Check size={14} /> : <Copy size={14} />}{copyError ? "Copy unavailable" : copied ? "Copied" : "Copy"}</button>}
      {canAct && <button onClick={onRetry}><RotateCcw size={14} />Try again</button>}
      {canAct && message.content && message.interrupted && <button onClick={onContinue}>Continue answer <ArrowUpRight size={14} /></button>}
      {message.interrupted && <span className="interrupted">Incomplete answer</span>}
    </div>}
  </article>;
});

export default function ChatPage() {
  const chat = useChat();
  const { status, providers } = useHealth();
  const [draft, setDraft] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scroller = useRef(null);
  const input = useRef(null);
  const pinned = useRef(true);
  const empty = chat.messages.length === 0;
  useEffect(() => {
    if (pinned.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [chat.messages, chat.statusText]);
  useEffect(() => {
    if (!chat.streaming) { setElapsed(0); return; }
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [chat.streaming]);
  const send = (text = draft) => {
    if (!text.trim() || chat.streaming) return;
    pinned.current = true;
    chat.sendMessage(text);
    setDraft("");
  };
  const newChat = () => { chat.clear(); setNavOpen(false); input.current?.focus(); };
  return <div className="app-shell">
    {navOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    <aside className={`sidebar ${navOpen ? "open" : ""}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setNavOpen(false); }}><span className="brand-mark"><Flower2 size={26} strokeWidth={1.5} /></span><span>IKS<span className="brand-caption">A WORLD OF KNOWLEDGE</span></span></a>
      <button className="new-chat" onClick={newChat}><Plus size={17} />New conversation<span>↗</span></button>
      <div className="nav-label">YOUR WORKSPACE</div>
      <button className="nav-item active" onClick={() => setNavOpen(false)}><Sparkles size={17} />Knowledge companion</button>
      <div className="nav-label topic-label">EXPLORE A LITTLE</div>
      {topics.map(({ icon: Icon, title, text }) => <button className="nav-item" key={title} disabled={chat.streaming} onClick={() => { send(text); setNavOpen(false); }}><Icon size={17} />{title}</button>)}
      <div className="sidebar-note"><span className="note-decoration">“</span><p>Let noble thoughts come to us from every side.</p><span>RIGVEDA · 1.89.1</span></div>
      <div className="sidebar-bottom"><span className="avatar">Y</span><div>Your learning space<small>Saved on this device</small></div><span className="local-dot" /></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="top-left"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={21} /></button><span>Knowledge companion</span><span className="version">IKS / 01</span></div>
        <div className="top-right"><span className={`connection ${status}`}><i />{status === "online" ? "Connected" : status === "checking" ? "Connecting" : "Offline"}</span><button className="icon-button" onClick={newChat} aria-label="New conversation"><Plus size={19} /></button></div>
      </header>
      <div className={`conversation-scroll ${empty ? "is-empty" : ""}`} ref={scroller} onScroll={e => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
        {empty ? <div className="welcome">
          <div className="eyebrow"><span />ROOTED IN TRADITION. OPEN TO DISCOVERY.</div>
          <h1>Ancient wisdom.<br /><em>New perspectives.</em></h1>
          <p className="intro">A space to explore Indian knowledge, ask better questions,<br className="desktop-break" /> and find connections across centuries of thought.</p>
          <div className="suggestions">{topics.map(({ icon: Icon, label, tag, text }) => <button className="suggestion" key={tag} onClick={() => send(text)}><span className="suggestion-top"><Icon size={21} strokeWidth={1.5} /><ArrowUpRight size={17} /></span><span className="suggestion-title">{label}</span><span className="suggestion-tag">{tag}</span></button>)}</div>
          <div className="explore-caption">FOLLOW YOUR CURIOSITY</div>
        </div> : <div className="thread">
          <div className="thread-date">YOUR CONVERSATION</div>
          {chat.messages.map((message, index) => <Message key={message.id || index} message={message} statusText={elapsed >= 12 ? `${chat.statusText} ${elapsed}s` : chat.statusText} canAct={!chat.streaming && index === chat.messages.length - 1} onRetry={chat.retry} onContinue={() => send("Continue the previous answer from where it stopped, without repeating the earlier text.")} />)}
          {chat.error && <div className="error-notice" role="alert"><span>{chat.error}</span><button onClick={() => chat.setError(null)} aria-label="Dismiss error"><X size={16} /></button></div>}
        </div>}
      </div>
      <div className="composer-area">
        <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
          <textarea ref={input} rows={2} value={draft} aria-label="Message" placeholder="What would you like to discover?" onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <div className="composer-toolbar"><div className="composer-model"><Sparkles size={14} />{providers ? <select aria-label="AI provider" value={chat.provider || providers.active} disabled={chat.streaming} onChange={e => chat.setProvider(e.target.value)}>{Object.entries(providers.available).filter(([, p]) => p.configured).map(([key]) => <option value={key} key={key}>{key === "gemini" ? "Gemini · Quick answers" : key}</option>)}</select> : <span>Knowledge companion</span>}<ChevronDown size={12} /></div><div className="send-group"><span className="enter-hint">{chat.streaming ? "You can stop anytime" : "Enter to send"}</span>{chat.streaming ? <button type="button" className="send-button" aria-label="Stop response" onClick={chat.cancel}><Square size={15} fill="currentColor" /></button> : <button type="submit" className="send-button" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={20} /></button>}</div></div>
        </form>
        <p className="composer-footnote">Explore with curiosity. Verify important facts with original sources.</p>
      </div>
    </main>
  </div>;
}
