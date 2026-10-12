import { mkdir, writeFile } from "node:fs/promises";
import { stripPreviewRuntime } from "./design-preview-html.mjs";
import { gzipSync } from "node:zlib";

const origin = "http://localhost:5173";
const response = await fetch(`${origin}/wb-preview?live=1`);
if (!response.ok) throw new Error(`Preview returned ${response.status}; start npm run dev first.`);
const html = await response.text();
if (!html.includes("BẢN XEM TRƯỚC LOCAL")) throw new Error("Expected the read-only design preview.");
const sheets = [...html.matchAll(/<link\b[^>]*>/gi)]
  .map(match => match[0])
  .filter(tag => /rel="stylesheet"/.test(tag))
  .map(tag => tag.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
const styles = await Promise.all(sheets.map(async href => {
  const url = new URL(href, origin);
  if (url.origin !== origin) throw new Error("Only local CSS is supported.");
  url.searchParams.set("direct", "");
  const css = await fetch(url);
  if (!css.ok) throw new Error(`CSS returned ${css.status}`);
  return css.text();
}));
const output = stripPreviewRuntime(html, styles.join("\n"));
const directory = new URL("../.sites-runtime/design-preview/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("index.html", directory), output);
const compressed = gzipSync(output);
await writeFile(new URL("index.html.gz", directory), compressed);
console.log(`Static preview ready at ${origin}/wb-preview`);
console.log(`HTML: ${Buffer.byteLength(html)} → ${Buffer.byteLength(output)} bytes including CSS. No hydration or HMR.`);
console.log(`Gzip transfer: ${compressed.length} bytes. Run this command again after changing the design.`);
