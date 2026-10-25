import sanitizeHtml from "sanitize-html";
import { WorkError } from "./work-px.ts";
import { validateOfficeArchive } from "./work-px-office.ts";
export const FILE_LIMIT = 1024 * 1024;
export const REPORT_FILES_LIMIT = 2 * FILE_LIMIT;
export const STORAGE_LIMIT = 100 * FILE_LIMIT;
export type StoredReportFile = { id: string; name: string; type: string; size: number; data: Uint8Array };
const types: Record<string,string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain", csv: "text/csv", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
export function cleanReportHtml(input: unknown) {
  if (input === undefined || input === "") return undefined;
  if (typeof input !== "string" || input.length > 80000) throw new WorkError("Nội dung định dạng quá lớn.", 413);
  return sanitizeHtml(input, {
    allowedTags: ["p","br","strong","b","em","i","u","s","ol","ul","li","h1","h2","h3","blockquote","pre","code","span","a"],
    allowedAttributes: { a: ["href","target","rel"], "*": ["style","class"] },
    allowedClasses: { "*": ["ql-align-center","ql-align-right","ql-align-justify","ql-size-small","ql-size-large","ql-size-huge","ql-font-serif","ql-font-monospace"] },
    allowedSchemes: ["http","https","mailto"], allowProtocolRelative: false,
    allowedStyles: { "*": { color: [/^#[0-9a-f]{3,8}$/i,/^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/], "background-color": [/^#[0-9a-f]{3,8}$/i,/^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/], "text-align": [/^(left|right|center|justify)$/] } },
    transformTags: { a: (_tag, attrs) => ({ tagName: "a", attribs: { href: attrs.href || "", target: "_blank", rel: "noopener noreferrer" } }) },
  });
}
export function decodeReportFiles(input: unknown): StoredReportFile[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 3) throw new WorkError("Tối đa 3 tệp cho mỗi báo cáo.");
  let total=0;
  return input.map(file => {
    if (!file || typeof file !== "object" || typeof file.name !== "string" || typeof file.base64 !== "string") throw new WorkError("Tệp đính kèm không hợp lệ.");
    const name=file.name.trim(); const ext=name.split(".").pop()?.toLowerCase() || "";
    if (!name || name.length>180 || /[\x00-\x1f\x7f\\/]/.test(name) || !types[ext]) throw new WorkError("Chỉ nhận PDF, DOCX, XLSX, PPTX, TXT, CSV, PNG và JPG.");
    if (file.base64.length>Math.ceil(FILE_LIMIT/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) throw new WorkError("Tệp tối đa 1 MB và phải được mã hóa đúng.",413);
    const bytes=Buffer.from(file.base64,"base64");
    if (!bytes.length || bytes.length>FILE_LIMIT || bytes.toString("base64")!==file.base64) throw new WorkError("Tệp trống, quá lớn hoặc không hợp lệ.",413);
    total+=bytes.length; if(total>REPORT_FILES_LIMIT) throw new WorkError("Tổng tệp mỗi báo cáo tối đa 2 MB.",413);
    const signature=bytes.subarray(0,8).toString("hex");
    const ok=ext==="pdf" ? bytes.subarray(0,5).toString()==="%PDF-" : ["docx","xlsx","pptx"].includes(ext) ? signature.startsWith("504b0304") : ext==="png" ? signature==="89504e470d0a1a0a" : ["jpg","jpeg"].includes(ext) ? signature.startsWith("ffd8ff") : !bytes.includes(0);
    if(!ok) throw new WorkError("Định dạng thực của tệp không khớp phần mở rộng.");
    if (["docx", "xlsx", "pptx"].includes(ext)) validateOfficeArchive(bytes, ext);
    return {id:crypto.randomUUID(),name,type:types[ext],size:bytes.length,data:bytes};
  });
}
