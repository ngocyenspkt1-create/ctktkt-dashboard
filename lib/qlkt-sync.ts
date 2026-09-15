export const qlktFieldLabels: Record<string, string> = {
  B: "Đầu cực S1",
  C: "Điểm bán S1",
  F: "Số giờ phát S1",
  H: "Đầu cực S2",
  I: "Điểm bán S2",
  L: "Số giờ phát S2",
  X: "Dầu FO tiêu thụ",
  AE: "Than tiêu thụ S1",
  AF: "Than tiêu thụ S2",
  AJ: "Nhiệt trị",
  AR: "Than tồn kho",
  AT: "Than nhập trong ngày",
  CC: "Nước bổ sung S1",
  CD: "Nước bổ sung S2",
};

export type QlktSyncEntry = {
  fieldCode: string;
  value: string;
  sourceLabel: string;
};

export type QlktSyncPayload = {
  version: 1;
  operatingDate: string;
  sourcePage: string;
  entries: QlktSyncEntry[];
};

const datePattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const numericPattern = /^-?\d+(?:\.\d+)?$/;

export function decodeQlktSyncHash(hash: string): QlktSyncPayload | null {
  const prefix = "#qlkt-sync=";
  if (!hash.startsWith(prefix)) return null;
  try {
    const encoded = hash.slice(prefix.length).replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Partial<QlktSyncPayload>;
    if (raw.version !== 1 || typeof raw.operatingDate !== "string" || !datePattern.test(raw.operatingDate) || typeof raw.sourcePage !== "string" || !Array.isArray(raw.entries)) return null;
    const seen = new Set<string>();
    const entries = raw.entries.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const fieldCode = String(item.fieldCode || ""), value = String(item.value || "").trim(), sourceLabel = String(item.sourceLabel || "QLKT").slice(0, 160);
      if (!(fieldCode in qlktFieldLabels) || seen.has(fieldCode) || !numericPattern.test(value)) return [];
      seen.add(fieldCode);
      return [{ fieldCode, value, sourceLabel }];
    });
    return entries.length ? { version: 1, operatingDate: raw.operatingDate, sourcePage: raw.sourcePage.slice(0, 500), entries } : null;
  } catch {
    return null;
  }
}

export function roundQlktValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}
