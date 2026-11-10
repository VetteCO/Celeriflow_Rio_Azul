import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const directory = resolve("public/vendor/pdfjs");
await mkdir(directory, { recursive: true });
await copyFile(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), resolve(directory, "pdf.worker.min.mjs"));
