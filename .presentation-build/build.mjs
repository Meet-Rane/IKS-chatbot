import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:\\iks";
const SKILL_DIR = "C:\\Users\\USER\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.904.11930\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".presentation-build");
const FINAL_PPTX = path.join(workspaceDir, "presentation", "IKS-Archive-Project-Presentation.pptx");
const RUNTIME_PYTHON = "C:\\Users\\USER\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href
);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const font = resolvePresentationFont();
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = { ink: "#18352E", sage: "#3E7963", cream: "#F6F3E9", light: "#D9E7D9", muted: "#577168", white: "#FFFFFF", gold: "#D7AD62" };
function box(slide, value, x, y, w, h, size, color = C.ink, bold = false) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none", line: { fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = { typeface: font, fontSize: size, color, bold, autoFit: "none" };
  return shape;
}
function base(title, kicker, number) {
  const slide = p.slides.add();
  slide.background.fill = C.cream;
  box(slide, kicker.toUpperCase(), 72, 35, 900, 26, 16, C.sage, true);
  box(slide, title, 72, 74, 1120, 80, 44, C.ink, true);
  box(slide, `IKS ARCHIVE  •  ${String(number).padStart(2, "0")}`, 72, 668, 420, 22, 14, C.muted);
  return slide;
}
function note(slide, text) { slide.speakerNotes.textFrame.setText(text); }

{
  const s = p.slides.add(); s.background.fill = C.ink;
  box(s, "IKS ARCHIVE", 72, 65, 800, 42, 22, C.gold, true);
  box(s, "An AI-assisted guide to\nIndian Knowledge Systems", 72, 145, 1110, 180, 56, C.white, true);
  box(s, "Project architecture  •  reliability  •  testing  •  limitations", 75, 377, 1080, 56, 25, C.light);
  box(s, "VIVA PRESENTATION", 75, 645, 800, 25, 17, C.gold, true);
  note(s, "Introduce the problem: IKS spans many subjects, and beginners need an accessible first point of entry. This is an AI-assisted learning prototype, not a source-verified scholarly archive.");
}
{
  const s = base("The problem and our objective", "01 / purpose", 2);
  box(s, "PROBLEM", 74, 205, 220, 35, 19, C.sage, true);
  box(s, "IKS topics and terminology are spread across philosophy, language, mathematics, medicine, and the arts.", 74, 252, 505, 190, 28);
  box(s, "OBJECTIVE", 678, 205, 230, 35, 19, C.sage, true);
  box(s, "Let a learner ask a natural-language question and receive an understandable, contextual starting answer.", 678, 252, 505, 190, 28);
  box(s, "Scope: exploration and explanation — not authenticated research or verified citations.", 74, 554, 1080, 58, 24, C.muted, true);
  note(s, "Explain the use case with a simple example: What is Padapatha? Be explicit that the model can be wrong; academic claims must be checked against trusted sources.");
}
{
  const s = base("Architecture at a glance", "02 / system", 3);
  box(s, "REACT UI", 76, 217, 225, 40, 25, C.sage, true);
  box(s, "Question, messages,\nretry and cancel", 76, 271, 225, 105, 24);
  box(s, "FASTAPI", 374, 217, 225, 40, 25, C.sage, true);
  box(s, "Validate request,\nselect provider,\napply timeouts", 374, 271, 245, 135, 24);
  box(s, "AI PROVIDER", 704, 217, 255, 40, 25, C.sage, true);
  box(s, "Current path: Gemini\nOther adapters:\nOpenAI, Anthropic, Ollama", 704, 271, 360, 145, 24);
  box(s, "POST /api/v1/chat/stream", 76, 492, 420, 40, 25, C.ink, true);
  box(s, "SSE events: meta  →  status  →  delta  →  done / error", 76, 550, 1040, 52, 26, C.muted);
  note(s, "Follow one question end-to-end. The browser sends message history. FastAPI validates it with Pydantic, keeps bounded recent history, adds the IKS prompt, and calls the selected provider. The route emits structured server-sent events. The backend does not store a server-side session.");
}
{
  const s = base("Technology choices", "03 / stack", 4);
  box(s, "FRONTEND", 75, 207, 230, 32, 18, C.sage, true);
  box(s, "React 18 + Vite 5\nResponsive CSS\nlucide-react icons", 75, 257, 310, 186, 27);
  box(s, "BACKEND", 458, 207, 230, 32, 18, C.sage, true);
  box(s, "Python + FastAPI\nPydantic models\nUvicorn server", 458, 257, 310, 186, 27);
  box(s, "INTEGRATION", 838, 207, 230, 32, 18, C.sage, true);
  box(s, "httpx + AI adapters\nSSE over HTTP\nBrowser localStorage", 838, 257, 330, 186, 27);
  box(s, "Local development: Vite :5173  →  proxy /api  →  FastAPI :8000", 75, 555, 1090, 57, 25, C.muted, true);
  note(s, "React manages changing chat state, FastAPI gives async routes and validation, and SSE is sufficient for one-way answer delivery. The API key stays in the backend. Browser localStorage is not a server database.");
}
{
  const s = base("What happens when a user asks?", "04 / request flow", 5);
  box(s, "1", 75, 192, 50, 60, 44, C.sage, true); box(s, "React sends recent chat turns as JSON", 150, 199, 950, 53, 27);
  box(s, "2", 75, 284, 50, 60, 44, C.sage, true); box(s, "Backend validates, limits history and applies the IKS prompt", 150, 291, 1010, 62, 27);
  box(s, "3", 75, 384, 50, 60, 44, C.sage, true); box(s, "Selected provider generates an answer", 150, 392, 950, 50, 27);
  box(s, "4", 75, 478, 50, 60, 44, C.sage, true); box(s, "Browser receives SSE completion or error; UI saves recent chat", 150, 486, 1020, 74, 27);
  note(s, "Mention the four endpoints: GET /health, GET /providers, POST /chat and POST /chat/stream. The request has user/assistant messages and an optional provider override. The browser sends the history each time; there is no persistent backend chat session.");
}
{
  const s = base("The reliability fix", "05 / response lifecycle", 6);
  box(s, "BEFORE", 75, 195, 230, 35, 18, C.sage, true);
  box(s, "Slow first response or an upstream stream ending midway could look like a stuck or finished answer.", 75, 247, 495, 185, 27);
  box(s, "NOW", 680, 195, 230, 35, 18, C.sage, true);
  box(s, "Explicit status, answer, done and error events; timeout handling; retry, cancel and continue controls.", 680, 247, 495, 185, 27);
  box(s, "A connection closing without done/error is treated as interrupted, not complete.", 75, 545, 1100, 71, 25, C.muted, true);
  note(s, "The backend sends a status heartbeat about every 10 seconds while working. Provider first/idle timeout defaults are 60 seconds, the route has a 180-second deadline, and the browser has a 90-second answer-progress timer. These are safeguards, not a guarantee that the provider is fast.");
}
{
  const s = base("A crucial Gemini trade-off", "06 / honest implementation", 7);
  box(s, "Current Gemini call", 75, 206, 480, 47, 30, C.sage, true);
  box(s, "The backend requests one complete JSON response and checks its finish reason before treating it as successful.", 75, 270, 1020, 170, 29);
  box(s, "STOP = complete    •    MAX_TOKENS = one continuation attempt", 75, 475, 1075, 65, 24, C.ink, true);
  box(s, "SSE to the browser does not mean live Gemini token streaming.", 75, 566, 1050, 47, 24, C.muted, true);
  note(s, "This is the most important technical nuance. The UI can show heartbeats while Gemini works, but first visible answer text arrives after a complete provider response. It improves completeness after premature upstream streaming failures but can increase time to first visible text. Other adapters can stream incrementally.");
}
{
  const s = base("State, security and constraints", "07 / responsible design", 8);
  box(s, "CHAT STATE", 75, 203, 275, 36, 18, C.sage, true);
  box(s, "Up to 60 messages saved in this browser's localStorage. No accounts or backend chat database.", 75, 255, 305, 235, 25);
  box(s, "SECRETS", 465, 203, 275, 36, 18, C.sage, true);
  box(s, "Provider API key belongs in backend .env. CORS restricts origins but is not authentication.", 465, 255, 305, 235, 25);
  box(s, "ACADEMIC USE", 845, 203, 290, 36, 18, C.sage, true);
  box(s, "The IKS prompt guides answers; citations are not checked against a trusted corpus.", 845, 255, 305, 235, 25);
  box(s, "This is a learning prototype, not a production-grade or source-verified archive.", 75, 562, 1080, 63, 24, C.muted, true);
  note(s, "Health only proves backend reachability, not AI provider availability. No auth, rate limiting or public deployment safeguards are implemented. Prompt injection and hallucinations remain possible. Never show the real .env or key.");
}
{
  const s = base("How we tested it", "08 / evidence", 9);
  box(s, "BACKEND TESTS", 75, 199, 350, 43, 22, C.sage, true);
  box(s, "Complete finish\nPremature finish error\nToken-limit continuation\nTerminal SSE error\nDisconnect cleanup", 75, 263, 470, 255, 26);
  box(s, "FRONTEND TESTS", 680, 199, 390, 43, 22, C.sage, true);
  box(s, "Split chunks and Unicode\nCRLF handling\nUnexpected EOF\nError / terminal events", 680, 263, 480, 255, 26);
  box(s, "Protocol tests verify handling — not the historical truth of model answers.", 75, 561, 1080, 61, 24, C.muted, true);
  note(s, "Backend tests use unittest. Frontend SSE parser tests use Node's test runner. A live smoke script can test the provider, but a successful sample answer is not a factual-quality evaluation. Before the presentation, rerun tests if dependencies or provider settings changed.");
}
{
  const s = base("Limitations and the next version", "09 / roadmap", 10);
  box(s, "LIMITATIONS TODAY", 75, 204, 475, 42, 22, C.sage, true);
  box(s, "Model can be inaccurate\nNo verified citations or RAG\nProvider latency / quota\nLocal-only chat history\nNo public-service safeguards", 75, 263, 485, 285, 26);
  box(s, "NEXT STEPS", 680, 204, 460, 42, 22, C.sage, true);
  box(s, "Curated IKS source corpus\nPassage-linked retrieval\nExpert answer evaluation\nProvider monitoring\nAuth and rate limits", 680, 263, 500, 285, 26);
  box(s, "Future features are proposals, not current implementation.", 75, 574, 1080, 50, 23, C.muted, true);
  note(s, "This slide shows technical maturity: do not overclaim. The most important academic improvement is retrieval from trusted passages with independently checked citations and expert evaluation.");
}
{
  const s = p.slides.add(); s.background.fill = C.ink;
  box(s, "DEMO & DISCUSSION", 75, 65, 920, 43, 22, C.gold, true);
  box(s, "Ask. Inspect. Verify.", 75, 155, 1100, 82, 55, C.white, true);
  box(s, "Demo question: “What is Padapatha?”", 75, 293, 1040, 55, 29, C.light);
  box(s, "Show the answer and completion state. Then explain why source claims still require verification.", 75, 385, 1065, 135, 28, C.white);
  box(s, "Thank you", 75, 620, 800, 45, 26, C.gold, true);
  note(s, "Before the demo, start frontend and backend manually and check a valid provider key/quota. They were stopped on user request and are not assumed running. Keep screenshots as backup. If asked what makes this innovative, emphasize response-completion handling and honest error states rather than claiming a new model or verified archive.");
}

const candidatePath = path.join(TMP_DIR, "candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const result = await finalizePresentation({
  workspaceDir, candidatePath, finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(TMP_DIR, "validation.json"),
});
for (let i = 0; i < p.slides.items.length; i++) {
  const slide = p.slides.items[i];
  const preview = await p.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(TMP_DIR, `slide-${i + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
}
console.log(JSON.stringify({ final: FINAL_PPTX, slides: p.slides.items.length, font, result }, null, 2));
