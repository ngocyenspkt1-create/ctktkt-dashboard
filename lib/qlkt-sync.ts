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
  DA: "Công suất đầu cực BQ S1",
  DB: "Công suất đầu cực BQ S2",
  DC: "Tổn thất khói khô BQ S1",
  DD: "Tổn thất khói khô BQ S2",
  DE: "Chân không bình ngưng BQ S1",
  DF: "Chân không bình ngưng BQ S2",
  DG: "Nhiệt độ nước làm mát tuần hoàn BQ S1",
  DH: "Nhiệt độ nước làm mát tuần hoàn BQ S2",
  J157: "Điện đầu cực PMIS S1 (MW)",
  K157: "Điện xuất tuyến PMIS S1 (MW)",
  J158: "Điện đầu cực PMIS S2 (MW)",
  K158: "Điện xuất tuyến PMIS S2 (MW)",
  C181: "02-PĐ Công suất đặt (MW)",
  D181: "02-PĐ Điện năng tác dụng đầu cực (Tr. kWh)",
  E181: "02-PĐ Điện năng phản kháng đầu cực (Tr. kVArh)",
  F181: "02-PĐ Điện năng giao (Tr. kWh)",
  G181: "02-PĐ Điện năng nhận (Tr. kWh)",
  H181: "02-PĐ Điện năng nhận chạy bù (Tr. kWh)",
  I181: "02-PĐ Tổn thất MBA kích từ (Tr. kWh)",
  J181: "02-PĐ Tổn thất MBA nâng (Tr. kWh)",
  K181: "02-PĐ Điện năng tự dùng (Tr. kWh)",
  L181: "02-PĐ Tỷ lệ tự dùng (%)",
  M181: "02-PĐ Nhiên liệu sử dụng (Tr. Tấn)",
  N181: "02-PĐ Suất hao nhiên liệu thô (g/kWh)",
  O181: "02-PĐ Suất hao nhiên liệu tinh (g/kWh)",
  P181: "02-PĐ Suất hao nhiệt thô (kJ/kWh)",
  Q181: "02-PĐ Suất hao nhiệt tinh (kJ/kWh)",
  R181: "02-PĐ Hệ số sử dụng",
  S181: "02-PĐ Hệ số đáp ứng",
  T181: "02-PĐ Độ phát thải",
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

export type QlktPpaReading = {
  meter: string;
  channel: string;
  operatingDate: string;
  total: number;
  intervals: number[];
  sourceName: string;
};

export type QlktPpaSyncPayload = {
  version: 1;
  kind: "ppa-meter";
  operatingDate: string;
  sourcePage: string;
  readings: QlktPpaReading[];
};

const datePattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const numericPattern = /^-?\d+(?:\.\d+)?$/;

export function validateQlktSyncPayload(value: unknown): QlktSyncPayload | null {
  try {
    const raw = value as Partial<QlktSyncPayload>;
    if (raw.version !== 1 || typeof raw.operatingDate !== "string" || !datePattern.test(raw.operatingDate) || typeof raw.sourcePage !== "string" || !Array.isArray(raw.entries)) return null;
    const seen = new Set<string>();
    const entries = raw.entries.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const fieldCode = String(item.fieldCode || ""), value = String(item.value || "").trim(), sourceLabel = String(item.sourceLabel || "QLKT").slice(0, 160);
      if (!(fieldCode in qlktFieldLabels) || seen.has(fieldCode)) return [];
      if (fieldCode !== "T181" && !numericPattern.test(value)) return [];
      seen.add(fieldCode);
      return [{ fieldCode, value, sourceLabel }];
    });
    return entries.length ? { version: 1, operatingDate: raw.operatingDate, sourcePage: raw.sourcePage.slice(0, 500), entries } : null;
  } catch {
    return null;
  }
}

export function decodeQlktSyncHash(hash: string): QlktSyncPayload | null {
  const prefix = "#qlkt-sync=";
  if (!hash.startsWith(prefix)) return null;
  try {
    const encoded = hash.slice(prefix.length).replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    return validateQlktSyncPayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function validateQlktPpaSyncPayload(value: unknown): QlktPpaSyncPayload | null {
  try {
    const raw = value as Partial<QlktPpaSyncPayload>;
    if (raw.version !== 1 || raw.kind !== "ppa-meter" || typeof raw.operatingDate !== "string" || !datePattern.test(raw.operatingDate) || typeof raw.sourcePage !== "string" || !Array.isArray(raw.readings)) return null;
    const allowedMeters = new Set(["DHA_S1", "DH1_285M", "DHA_S2", "DH1_283M"]), seen = new Set<string>();
    const readings = raw.readings.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const meter = String(item.meter || "").toUpperCase(), channel = String(item.channel || "");
      if (!allowedMeters.has(meter) || seen.has(meter) || channel.toLowerCase() !== "kwhgiao" || item.operatingDate !== raw.operatingDate || !Array.isArray(item.intervals) || item.intervals.length !== 48) return [];
      const intervals = item.intervals.map(Number), total = Number(item.total);
      if (!Number.isFinite(total) || total < 0 || intervals.some(value => !Number.isFinite(value) || value < 0)) return [];
      seen.add(meter);
      return [{ meter, channel: "kWhGiao", operatingDate: raw.operatingDate, total, intervals, sourceName: String(item.sourceName || "QLKT · Số liệu đo đếm công tơ").slice(0, 500) }];
    });
    return readings.length === 4 ? { version: 1, kind: "ppa-meter", operatingDate: raw.operatingDate, sourcePage: raw.sourcePage.slice(0, 500), readings } : null;
  } catch {
    return null;
  }
}

export function decodeQlktPpaSyncHash(hash: string): QlktPpaSyncPayload | null {
  const prefix = "#qlkt-sync=";
  if (!hash.startsWith(prefix)) return null;
  try {
    const encoded = hash.slice(prefix.length).replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    return validateQlktPpaSyncPayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function normalizeQlktValue(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const parsed = Number(clean);
  // Keep the precision reported by QLKT. In particular, daily electricity is
  // converted from MWh to million kWh before reaching this function, so two
  // decimal places would discard up to 10,000 kWh and distort heat-rate
  // calculations. String(Number(...)) only normalizes the numeric text; it
  // does not intentionally round the source value.
  return Number.isFinite(parsed) ? String(parsed) : clean;
}
