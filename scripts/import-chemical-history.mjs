import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client/http";
import * as XLSX from "xlsx";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const inputPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!inputPath) throw new Error("Cách dùng: node scripts/import-chemical-history.mjs <file.csv> [--dry-run]");

const normalizeText = value => String(value ?? "").replace(/\r?\n/g, " / ").trim();
const normalizeKey = value => normalizeText(value).toLocaleLowerCase("vi-VN").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/%/g, "").replace(/\s+/g, " ");
const iso = date => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

function normalizePurpose(value) {
  const original = normalizeText(value);
  const key = normalizeKey(original);
  if (key === "su dung cho san xuat") return "Sử dụng cho sản xuất";
  if (key === "pha de thuc hien xln lo") return "Pha để thực hiện XLN Lò";
  const regeneration = key.match(/^tai sinh hat (art|crt) hon hop ([1-7])$/);
  if (regeneration) return `Tái sinh hạt ${regeneration[1].toUpperCase()} Hỗn Hợp ${regeneration[2]}`;
  return original || "Sử dụng cho sản xuất";
}

const catalog = new Map([
  ["pac long", { code: "PAC_LIQUID", materialCode: "1.61.86.566.VIE.00.000", name: "PAC lỏng" }],
  ["naocl", { code: "NAOCL", materialCode: "1.61.26.003.VIE.00.000", name: "NaOCl" }],
  ["nh4oh 20", { code: "NH4OH_20", materialCode: "1.61.86.518.VIE.00.000", name: "NH₄OH 20%" }],
  ["hcl 31", { code: "HCL_31", materialCode: "1.61.06.038.VIE.00.000", name: "HCl 31%" }],
  ["naoh 31", { code: "NAOH_31", materialCode: "1.61.16.008.VIE.00.000", name: "NaOH 31%" }],
  ["naoh", { code: "NAOH_31", materialCode: "1.61.16.008.VIE.00.000", name: "NaOH 31%" }],
]);

function validDay(month, day) {
  return Number.isInteger(day) && day >= 1 && day <= new Date(Date.UTC(2026, month, 0)).getUTCDate();
}

function resolveOrderedDate(raw, state) {
  const match = String(raw || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const currentDays = [];
  if (a === state.month && validDay(state.month, b)) currentDays.push(b);
  if (b === state.month && validDay(state.month, a)) currentDays.push(a);
  const nextDays = [];
  if (state.month < 12) {
    if (a === state.month + 1 && validDay(state.month + 1, b)) nextDays.push(b);
    if (b === state.month + 1 && validDay(state.month + 1, a)) nextDays.push(a);
  }
  if (nextDays.length && state.maxDay >= 25 && Math.min(...nextDays) <= 7) {
    state.month += 1;
    state.maxDay = Math.min(...nextDays);
    return new Date(Date.UTC(2026, state.month - 1, state.maxDay));
  }
  let day = currentDays[0];
  if (!day) {
    const fallback = [a, b].filter(value => validDay(state.month, value)).sort((left, right) => right - left);
    day = fallback[0];
  }
  if (!day) return null;
  state.maxDay = Math.max(state.maxDay, day);
  return new Date(Date.UTC(2026, state.month - 1, day));
}

const workbook = XLSX.read(readFileSync(path.resolve(inputPath), "utf8"), { type: "string", raw: false, cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
const headers = matrix[0].map(normalizeText);
const column = name => headers.findIndex(header => header === name || header.endsWith(` ${name}`));
const columns = {
  date: 0,
  material: column("Mã vật tư"),
  chemical: column("Tên vật tư"),
  unit: column("Đơn vị"),
  quantity: column("Số lượng"),
  purpose: column("Nội dung công tác/lý do thay"),
  performer: column("Người thực hiện"),
  reference: column("Đính kèm"),
  position: column("Cương vị"),
};
if (Object.values(columns).some(index => index < 0)) {
  throw new Error(`CSV không đủ các cột bắt buộc của sheet hóa chất: ${JSON.stringify(headers)}`);
}

const rows = matrix.slice(1).map((values, index) => ({ rowNumber: index + 2, values }));
const orderedState = { month: 1, maxDay: 1 };
for (const row of rows) {
  row.explicitDate = resolveOrderedDate(normalizeText(row.values[columns.date]), orderedState);
  row.chemicalKey = normalizeKey(row.values[columns.chemical]);
  row.performerKey = normalizeKey(row.values[columns.performer]);
}

const sequentialStart = rows.findIndex(row => row.chemicalKey === "naocl" && iso(row.explicitDate) === "2026-08-08");
if (sequentialStart < 0) throw new Error("Không tìm thấy mốc NaOCl ngày 08/08/2026 để khôi phục chuỗi ngày bị trống.");
const anchorIndexes = [];
for (let index = sequentialStart; index < rows.length; index += 1) {
  if (rows[index].chemicalKey === "naocl") anchorIndexes.push(index);
}
const expectedLastDate = addDays(new Date(Date.UTC(2026, 7, 8)), anchorIndexes.length - 1);
if (anchorIndexes.length !== 53 || iso(expectedLastDate) !== "2026-09-29") {
  throw new Error(`Chuỗi NaOCl không đạt kiểm tra 53 ngày 08/08–29/09 (nhận ${anchorIndexes.length}, kết thúc ${iso(expectedLastDate)}).`);
}
for (let order = 0; order < anchorIndexes.length; order += 1) {
  rows[anchorIndexes[order]].anchorDate = addDays(new Date(Date.UTC(2026, 7, 8)), order);
}
for (let index = sequentialStart - 1; index < rows.length; index += 1) {
  const previousAnchor = [...anchorIndexes].reverse().find(anchor => anchor <= index);
  const nextAnchor = anchorIndexes.find(anchor => anchor >= index);
  let chosen = previousAnchor ?? nextAnchor;
  if (previousAnchor != null && nextAnchor != null && previousAnchor !== nextAnchor) {
    const rowPerson = rows[index].performerKey;
    const previousMatches = rowPerson && rowPerson === rows[previousAnchor].performerKey;
    const nextMatches = rowPerson && rowPerson === rows[nextAnchor].performerKey;
    if (nextMatches && !previousMatches) chosen = nextAnchor;
    else if (previousMatches && !nextMatches) chosen = previousAnchor;
    else chosen = index - previousAnchor <= nextAnchor - index ? previousAnchor : nextAnchor;
  }
  if (chosen != null) rows[index].inferredDate = rows[chosen].anchorDate;
}

const records = [];
const skipped = { blankQuantity: 0, unknownChemical: 0, missingDate: 0 };
for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  const chemical = catalog.get(row.chemicalKey);
  if (!chemical) {
    if (normalizeText(row.values[columns.chemical])) skipped.unknownChemical += 1;
    continue;
  }
  const quantity = Number(normalizeText(row.values[columns.quantity]).replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    skipped.blankQuantity += 1;
    continue;
  }
  const usageDate = index >= sequentialStart - 1 ? row.inferredDate : row.explicitDate;
  if (!usageDate) {
    skipped.missingDate += 1;
    continue;
  }
  records.push({
    sourceKey: `google-sheet:hoa-chat-xln-polishing:row-${row.rowNumber}`,
    usageDate: iso(usageDate),
    chemical,
    unit: "Tấn",
    quantity,
    purpose: normalizePurpose(row.values[columns.purpose]),
    performer: normalizeText(row.values[columns.performer]) || "Dữ liệu lịch sử Google Sheet",
    position: normalizeText(row.values[columns.position]),
    reference: normalizeText(row.values[columns.reference]),
  });
}

const summary = {};
for (const record of records) {
  summary[record.chemical.code] ||= { rows: 0, total: 0 };
  summary[record.chemical.code].rows += 1;
  summary[record.chemical.code].total += record.quantity;
}
console.log(JSON.stringify({ dryRun, inputRows: rows.length, importableRows: records.length, firstDate: records[0]?.usageDate, lastDate: records.at(-1)?.usageDate, skipped, summary }, null, 2));
if (dryRun) process.exit(0);

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Thiếu TURSO_DATABASE_URL trong .env.local.");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await client.execute(`CREATE TABLE IF NOT EXISTS chemical_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    usage_date TEXT NOT NULL, chemical_code TEXT NOT NULL, material_code TEXT NOT NULL,
    chemical_name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'Tấn', quantity REAL NOT NULL,
    purpose TEXT NOT NULL DEFAULT '', plant_unit TEXT NOT NULL DEFAULT 'Chung', reference TEXT NOT NULL DEFAULT '',
    entered_by_user_id INTEGER NOT NULL, entered_by_name TEXT NOT NULL, entered_by_position TEXT NOT NULL,
    source_key TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const columnsResult = await client.execute("PRAGMA table_info(chemical_usage_logs)");
  if (!columnsResult.rows.some(row => String(row[1]) === "source_key")) {
    await client.execute("ALTER TABLE chemical_usage_logs ADD COLUMN source_key TEXT NOT NULL DEFAULT ''");
  }
  await client.execute("CREATE INDEX IF NOT EXISTS idx_chemical_usage_date ON chemical_usage_logs (usage_date)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_chemical_usage_code_date ON chemical_usage_logs (chemical_code, usage_date)");
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS uidx_chemical_usage_source_key ON chemical_usage_logs (source_key) WHERE source_key <> ''");

  for (let offset = 0; offset < records.length; offset += 100) {
    const batch = records.slice(offset, offset + 100).map(record => ({
      sql: `INSERT OR IGNORE INTO chemical_usage_logs (
        usage_date, chemical_code, material_code, chemical_name, unit, quantity, purpose,
        plant_unit, reference, entered_by_user_id, entered_by_name, entered_by_position,
        source_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Chung', ?, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [record.usageDate, record.chemical.code, record.chemical.materialCode, record.chemical.name,
        record.unit, record.quantity, record.purpose, record.reference, record.performer, record.position, record.sourceKey],
    }));
    await client.batch(batch, "write");
  }
  const imported = await client.execute("SELECT COUNT(*) FROM chemical_usage_logs WHERE source_key LIKE 'google-sheet:hoa-chat-xln-polishing:%'");
  console.log(JSON.stringify({ importedRowsInDatabase: Number(imported.rows[0]?.[0] || 0) }, null, 2));
} finally {
  client.close();
}
