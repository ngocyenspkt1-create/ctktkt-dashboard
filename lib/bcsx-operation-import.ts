import ExcelJS from "exceljs";
import type { OperatingEvent } from "@/lib/bcsx";

export type OperationUnit = "S1" | "S2";

export type OperationImportResult = {
  kind: "BCSX_OPERATION_IMPORT";
  version: 1;
  operatingDate: string;
  sourceFileName: string;
  sourceRows: number;
  ignoredRows: number;
  initialPowerMw: Record<OperationUnit, number>;
  events: Record<OperationUnit, OperatingEvent[]>;
  allEvents: Array<OperatingEvent & { unit: OperationUnit }>;
};

type SourceCommand = {
  rowNumber: number;
  unit: OperationUnit;
  startAt: string;
  endAt: string;
  startOrder: number;
  endOrder: number;
  completedPowerMw: number;
};

const units = new Set<OperationUnit>(["S1", "S2"]);
const minimumPowerMw = 435.7;
const maximumPowerMw = 622.5;
const requiredHeaders = {
  plant: "nha may",
  unit: "to may",
  command: "noi dung lenh",
  completedPower: "cs hoan thanh (mw)",
  startAt: "thoi diem bdth",
  endAt: "thoi diem hoan thanh",
  completed: "hoan thanh",
} as const;

function normalizeText(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/\s+/g, " ").trim().toLowerCase();
}

function readNumber(value: unknown, location: string) {
  const numberValue = typeof value === "number" ? value : Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(numberValue)) throw new Error(location + ": công suất hoàn thành không phải số hợp lệ.");
  return numberValue;
}

function isCompleted(value: unknown) {
  if (value === true || value === 1) return true;
  return ["1", "true", "x", "yes", "co"].includes(normalizeText(value));
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateToTimestamp(value: Date) {
  return String(value.getUTCFullYear()) + "-" + pad2(value.getUTCMonth() + 1) + "-" + pad2(value.getUTCDate()) + " " + pad2(value.getUTCHours()) + ":" + pad2(value.getUTCMinutes());
}

function readTimestamp(value: unknown, location: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateToTimestamp(value);
  if (typeof value === "number" && Number.isFinite(value)) return dateToTimestamp(new Date(Math.round((value - 25569) * 86400 * 1000)));
  const text = String(value ?? "").trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3] + " " + isoMatch[4] + ":" + isoMatch[5];
  const vnMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})/);
  if (vnMatch) return vnMatch[3] + "-" + pad2(Number(vnMatch[2])) + "-" + pad2(Number(vnMatch[1])) + " " + pad2(Number(vnMatch[4])) + ":" + vnMatch[5];
  throw new Error(location + ": thời điểm không hợp lệ.");
}

function readTimestampOrder(value: unknown, timestamp: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return Math.round((value - 25569) * 86400 * 1000);
  return Date.UTC(Number(timestamp.slice(0, 4)), Number(timestamp.slice(5, 7)) - 1, Number(timestamp.slice(8, 10)), Number(timestamp.slice(11, 13)), Number(timestamp.slice(14, 16)));
}

function findHeaderRow(worksheet: ExcelJS.Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.rowCount); rowNumber += 1) {
    const headers = new Map<string, number>();
    worksheet.getRow(rowNumber).eachCell((cell, columnNumber) => headers.set(normalizeText(cell.value), columnNumber));
    if (Object.values(requiredHeaders).every(header => headers.has(header))) return { rowNumber, headers };
  }
  throw new Error("Sheet " + worksheet.name + " không có đủ cột bắt buộc của file DanhSachLenhKetThuc.");
}

function findSourceSheet(workbook: ExcelJS.Workbook) {
  const preferred = workbook.getWorksheet("All");
  const candidates = preferred ? [preferred, ...workbook.worksheets.filter(sheet => sheet !== preferred)] : workbook.worksheets;
  for (const worksheet of candidates) {
    try {
      return { worksheet, ...findHeaderRow(worksheet) };
    } catch {
      continue;
    }
  }
  throw new Error("Không tìm thấy sheet chứa danh sách lệnh kết thúc hợp lệ.");
}

function minuteDifference(later: string, earlier: string) {
  const parse = (value: string) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)), Number(value.slice(11, 13)), Number(value.slice(14, 16)));
  return (parse(later) - parse(earlier)) / 60000;
}

function inferInitialPower(commands: SourceCommand[]) {
  const first = commands[0];
  const second = commands[1];
  if (!first) return minimumPowerMw;
  if (first.completedPowerMw <= minimumPowerMw) return maximumPowerMw;
  if (first.completedPowerMw >= maximumPowerMw) return minimumPowerMw;
  if (second) {
    const gapMinutes = minuteDifference(second.startAt, first.endAt);
    if (gapMinutes >= 0 && gapMinutes <= 60) {
      if (second.completedPowerMw > first.completedPowerMw) return minimumPowerMw;
      if (second.completedPowerMw < first.completedPowerMw) return maximumPowerMw;
    }
  }
  return minimumPowerMw;
}

function formatPower(value: number) {
  return String(Number(value.toFixed(3)));
}

function buildDescription(unit: OperationUnit, fromPower: number, toPower: number) {
  if (toPower > fromPower) return "Tăng tải " + unit + " từ " + formatPower(fromPower) + "MW lên " + formatPower(toPower) + "MW";
  if (toPower < fromPower) return "Giảm tải " + unit + " từ " + formatPower(fromPower) + "MW về " + formatPower(toPower) + "MW";
  return "Duy trì tải " + unit + " ở " + formatPower(toPower) + "MW";
}

export async function parseOperationCommandWorkbook(bytes: ArrayBuffer, sourceFileName: string, expectedDate?: string): Promise<OperationImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const { worksheet, rowNumber: headerRowNumber, headers } = findSourceSheet(workbook);
  const column = (key: keyof typeof requiredHeaders) => headers.get(requiredHeaders[key]) as number;
  const commands: SourceCommand[] = [];
  let nonEmptyRows = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
    if (!rowValues.some(value => value !== null && value !== undefined && String(value).trim() !== "")) continue;
    nonEmptyRows += 1;
    const plant = normalizeText(row.getCell(column("plant")).value);
    const unitValue = String(row.getCell(column("unit")).value ?? "").trim().toUpperCase() as OperationUnit;
    const command = normalizeText(row.getCell(column("command")).value);
    if (!plant.includes("duyen hai 1") || !units.has(unitValue) || command !== "thay doi cong suat" || !isCompleted(row.getCell(column("completed")).value)) continue;
    const location = worksheet.name + "!" + rowNumber;
    const startValue = row.getCell(column("startAt")).value;
    const endValue = row.getCell(column("endAt")).value;
    const startAt = readTimestamp(startValue, location);
    const endAt = readTimestamp(endValue, location);
    if (endAt < startAt) throw new Error(location + ": thời điểm hoàn thành trước thời điểm bắt đầu.");
    commands.push({ rowNumber, unit: unitValue, startAt, endAt, startOrder: readTimestampOrder(startValue, startAt), endOrder: readTimestampOrder(endValue, endAt), completedPowerMw: readNumber(row.getCell(column("completedPower")).value, location) });
  }

  if (!commands.length) throw new Error("File không có lệnh thay đổi công suất đã hoàn thành của Duyên Hải 1 cho S1/S2.");
  const operatingDates = new Set(commands.map(command => command.startAt.slice(0, 10)));
  if (operatingDates.size !== 1) throw new Error("File chứa lệnh của nhiều ngày; hãy xuất riêng từng ngày trước khi nhập.");
  const operatingDate = [...operatingDates][0];
  if (commands.some(command => command.endAt.slice(0, 10) !== operatingDate)) throw new Error("File có lệnh kết thúc khác ngày bắt đầu; chưa thể tự đưa vào Mục 3.");
  if (expectedDate && expectedDate !== operatingDate) throw new Error("File là ngày " + operatingDate.split("-").reverse().join("/") + ", không phải ngày đang chọn " + expectedDate.split("-").reverse().join("/") + ".");

  commands.sort((left, right) => left.startOrder - right.startOrder || left.endOrder - right.endOrder || left.rowNumber - right.rowNumber);
  const initialPowerMw: Record<OperationUnit, number> = { S1: minimumPowerMw, S2: minimumPowerMw };
  const events: Record<OperationUnit, OperatingEvent[]> = { S1: [], S2: [] };
  const eventByRow = new Map<number, OperatingEvent>();
  for (const unit of ["S1", "S2"] as const) {
    const unitCommands = commands.filter(command => command.unit === unit);
    initialPowerMw[unit] = inferInitialPower(unitCommands);
    let currentPower = initialPowerMw[unit];
    for (const command of unitCommands) {
      const event = { startAt: command.startAt, endAt: command.endAt, eventType: 1, description: buildDescription(unit, currentPower, command.completedPowerMw) };
      events[unit].push(event);
      eventByRow.set(command.rowNumber, event);
      currentPower = command.completedPowerMw;
    }
  }

  const allEvents = commands.map(command => ({ ...(eventByRow.get(command.rowNumber) as OperatingEvent), unit: command.unit }));
  return { kind: "BCSX_OPERATION_IMPORT", version: 1, operatingDate, sourceFileName, sourceRows: commands.length, ignoredRows: Math.max(0, nonEmptyRows - commands.length), initialPowerMw, events, allEvents };
}

function timeOnlyDate(timestamp: string) {
  return new Date(Date.UTC(1899, 11, 30, Number(timestamp.slice(11, 13)), Number(timestamp.slice(14, 16))));
}

export async function buildQlktOperationWorkbook(result: OperationImportResult): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("DH1 TGVH", { views: [{ activeCell: "B2", zoomScale: 85, zoomScaleNormal: 85 }] });
  worksheet.properties.defaultRowHeight = 21.75;
  worksheet.columns = [
    { header: "BĐ", key: "startAt", width: 7.1328125 },
    { header: "KT", key: "endAt", width: 7.1328125 },
    { header: "Mã SK", key: "eventType", width: 9.1328125 },
    { header: "Sự kiện", key: "description", width: 46.73046875 },
    { header: "TM", key: "plant", width: 9.1328125 },
  ];
  worksheet.getRow(1).height = 16.5;
  worksheet.getRow(1).eachCell(cell => {
    cell.font = { name: "Times New Roman", family: 1, charset: 163, size: 13, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    cell.border = { left: { style: "thin" }, right: { style: "thin" }, top: { style: "thin" }, bottom: { style: "thin" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  for (const event of result.allEvents) {
    const row = worksheet.addRow({ startAt: timeOnlyDate(event.startAt), endAt: timeOnlyDate(event.endAt), eventType: event.eventType, description: event.description, plant: "DH1" });
    row.eachCell(cell => {
      cell.font = { name: "Times New Roman", family: 1, charset: 163, size: 12 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    row.getCell(1).numFmt = "[$-1000000]h:mm;@";
    row.getCell(2).numFmt = "[$-1000000]h:mm;@";
    row.getCell(3).numFmt = "0";
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export function qlktOperationFileName(operatingDate: string) {
  const [year, month, day] = operatingDate.split("-");
  return "DH1_Thoi_gian_VH_" + day + "." + month + "." + year + ".xlsx";
}
