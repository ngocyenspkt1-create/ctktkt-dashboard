import { inflateRawSync } from "node:zlib";
import { WorkError } from "./work-px.ts";

const EXPANDED_LIMIT = 20 * 1024 * 1024;
const PARTS: Record<string, [string, string]> = {
  docx: ["word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"],
  xlsx: ["xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],
  pptx: ["ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"],
};
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Bounded ZIP validation: never trust declared sizes when inflating user files. */
export function validateOfficeArchive(bytes: Buffer, extension: string) {
  const fail = () => { throw new WorkError("Tệp Office bị hỏng, không đúng loại hoặc vượt giới hạn 2.000 mục / 20 MiB sau giải nén."); };
  try {
    let end = bytes.length - 22;
    const earliest = Math.max(0, end - 65535);
    while (end >= earliest && (bytes.readUInt32LE(end) !== 0x06054b50 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length)) end--;
    if (end < earliest) return fail();
    const count = bytes.readUInt16LE(end + 10), directorySize = bytes.readUInt32LE(end + 12), directory = bytes.readUInt32LE(end + 16);
    if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || !count || count > 2000 || directory + directorySize !== end) return fail();
    const [mainPart, mainType] = PARTS[extension];
    const required = new Map<string, Buffer>(), names = new Set<string>(), ranges: [number, number][] = [];
    let cursor = directory, expanded = 0;
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) return fail();
      const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), crc = bytes.readUInt32LE(cursor + 16);
      const compressed = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
      const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
      const local = bytes.readUInt32LE(cursor + 42), next = cursor + 46 + nameLength + extraLength + commentLength;
      if (next > end || bytes.readUInt16LE(cursor + 34) || flags & 0x2041 || ![0, 8].includes(method) || expanded + size > EXPANDED_LIMIT) return fail();
      const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
      if (!name || names.has(name) || name.startsWith("/") || /[\\\x00]/.test(name) || name.split("/").includes("..")) return fail();
      names.add(name);
      if (local + 30 > directory || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) return fail();
      const localNameLength = bytes.readUInt16LE(local + 26), dataStart = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
      if (dataStart + compressed > directory || !bytes.subarray(local + 30, local + 30 + localNameLength).equals(bytes.subarray(cursor + 46, cursor + 46 + nameLength))) return fail();
      const packed = bytes.subarray(dataStart, dataStart + compressed);
      // maxOutputLength also bounds archives whose central directory lies about size.
      const content = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.max(1, EXPANDED_LIMIT - expanded) });
      if (content.length !== size || expanded + content.length > EXPANDED_LIMIT || crc32(content) !== crc) return fail();
      expanded += content.length;
      let dataEnd = dataStart + compressed;
      if (flags & 8) {
        if (dataEnd + 4 <= directory && bytes.readUInt32LE(dataEnd) === 0x08074b50) dataEnd += 4;
        if (dataEnd + 12 > directory || bytes.readUInt32LE(dataEnd) !== crc || bytes.readUInt32LE(dataEnd + 4) !== compressed || bytes.readUInt32LE(dataEnd + 8) !== size) return fail();
        dataEnd += 12;
      } else if (bytes.readUInt32LE(local + 14) !== crc || bytes.readUInt32LE(local + 18) !== compressed || bytes.readUInt32LE(local + 22) !== size) return fail();
      ranges.push([local, dataEnd]);
      if (name === "[Content_Types].xml" || name === mainPart) required.set(name, content);
      cursor = next;
    }
    if (cursor !== end) return fail();
    ranges.sort((a, b) => a[0] - b[0]);
    if (ranges.some((range, index) => index > 0 && range[0] < ranges[index - 1][1])) return fail();
    const types = required.get("[Content_Types].xml")?.toString("utf8"), main = required.get(mainPart);
    if (!types || !main?.length) return fail();
    const overrides = types.match(/<(?:[\w.-]+:)?Override\b[^>]*>/g) || [];
    const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2];
    if (!overrides.some(tag => attribute(tag, "PartName") === `/${mainPart}` && attribute(tag, "ContentType") === mainType)) return fail();
  } catch (error) {
    if (error instanceof WorkError) throw error;
    fail();
  }
}
