import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { ownDownloadStream } from "./blob-stream";

test("download owns the provider reader while its HTTP body remains usable after an audit await", async () => {
  const bytes = new TextEncoder().encode("Original privado com acentuação.");
  const source = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  const forwarded = ownDownloadStream(source);
  await Promise.resolve();
  assert.equal(source.locked, true);
  assert.equal(forwarded.locked, false);
  assert.equal(Readable.isDisturbed(forwarded), false);
  assert.deepEqual(new Uint8Array(await new Response(forwarded).arrayBuffer()), bytes);
  assert.equal(source.locked, false);
});
test("download cancellation reaches storage and does not prebuffer the entire original", async () => {
  let pulls = 0, cancelled = false;
  const source = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const forwarded = ownDownloadStream(source);
  await Promise.resolve(); assert.equal(pulls, 0);
  const reader = forwarded.getReader(); await reader.read(); assert.equal(pulls, 1);
  await reader.cancel("download interrupted"); assert.equal(cancelled, true); assert.equal(source.locked, false);
});
