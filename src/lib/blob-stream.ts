/** Claim the provider stream immediately; downstream audit awaits must not share its body state. */
export function ownDownloadStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) { reader.releaseLock(); controller.close(); }
        else controller.enqueue(chunk.value);
      } catch (error) { reader.releaseLock(); controller.error(error); }
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } finally { reader.releaseLock(); }
    },
  }, { highWaterMark: 0 });
}
