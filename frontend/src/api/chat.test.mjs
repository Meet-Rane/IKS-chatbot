import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
const source = await readFile(new URL("./chat.js", import.meta.url), "utf8");
const { readEvents } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const encoder = new TextEncoder();
function stream(chunks) {
  return new ReadableStream({ start(controller) { chunks.forEach(c => controller.enqueue(c)); controller.close(); } });
}
test("SSE survives byte-sized chunks, Unicode, comments and CRLF", async () => {
  const wire = ': heartbeat\r\ndata:{"type":"delta","text":"नमस्ते"}\r\n\r\ndata: {"type":"done"}\r\n\r\n';
  const events = [];
  await readEvents(stream([...encoder.encode(wire)].map(b => Uint8Array.of(b))), e => events.push(e));
  assert.deepEqual(events, [{ type: "delta", text: "नमस्ते" }, { type: "done" }]);
});
test("truncated connection is an error, not success", async () => {
  await assert.rejects(readEvents(stream([encoder.encode('data: {"type":"delta","text":"partial"}\n\n')]), () => {}), /interrupted/);
});
test("final event without trailing newline is consumed", async () => {
  const events = [];
  await readEvents(stream([encoder.encode('data: {"type":"done"}')]), e => events.push(e));
  assert.equal(events[0].type, "done");
});
test("provider error is terminal and later text is not appended", async () => {
  const events = [];
  await readEvents(stream([encoder.encode('data: {"type":"error","text":"busy"}\n\ndata: {"type":"delta","text":"wrong"}\n\n')]), e => events.push(e));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "error");
});
