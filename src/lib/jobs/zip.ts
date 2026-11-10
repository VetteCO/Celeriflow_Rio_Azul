import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";

// ZIP STORE with data descriptors: file bytes are copied in bounded chunks, never buffered as a whole.
// ZIP32 is intentional: reject >2 GiB before overflowing headers. UTF-8 filenames and CRC32 are standard.
const table = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
export async function writeZip(output: string, entries: { name: string; path: string }[], signal: AbortSignal) {
  const file = await open(output, "wx"); let offset = 0;
  const central: Buffer[] = [];
  async function write(buffer: Buffer) {
    let written = 0;
    while (written < buffer.length) { const result = await file.write(buffer, written, buffer.length - written); written += result.bytesWritten; }
    offset += buffer.length;
    if (offset > 2_000_000_000) throw new Error("ZIP excede o limite de 2 GB.");
  }
  try {
    for (const entry of entries) {
      signal.throwIfAborted();
      const size = (await stat(entry.path)).size;
      if (size + offset > 2_000_000_000) throw new Error("ZIP excede o limite de 2 GB.");
      const name = Buffer.from(entry.name, "utf8"), start = offset;
      const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0808, 6); header.writeUInt16LE(33, 12); header.writeUInt16LE(name.length, 26);
      await write(header); await write(name); let crc = 0xffffffff;
      for await (const chunk of createReadStream(entry.path, { signal })) {
        const bytes = chunk as Buffer;
        for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
        await write(bytes);
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(16); descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(size, 8); descriptor.writeUInt32LE(size, 12); await write(descriptor);
      const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x0808, 8); directory.writeUInt16LE(33, 14); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(size, 20); directory.writeUInt32LE(size, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(start, 42);
      central.push(directory, name);
    }
    const start = offset;
    for (const part of central) await write(part);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(offset - start, 12); end.writeUInt32LE(start, 16); await write(end);
  } finally { await file.close(); }
}
