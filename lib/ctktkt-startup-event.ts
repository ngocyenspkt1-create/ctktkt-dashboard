import type ExcelJS from "exceljs";
import { calculateIncidentOilSummary, type CtktktDayEntries } from "./ctktkt-report.ts";

const eventLabels: Record<string, string> = {
  startup: "Khởi động",
  shutdown: "Ngừng",
  incident_oil: "Đốt dầu do sự cố",
};

function ktktEntries(row: Record<string, string>): CtktktDayEntries {
  const entries: CtktktDayEntries = {};
  for (const [code, value] of Object.entries(row)) {
    if (code.startsWith("KTKT:")) entries[code.slice(5)] = value;
  }
  return entries;
}

function numeric(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function display(value: number | null) {
  return value === null ? "chưa đủ chỉ số" : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value)} tấn`;
}

export function applyCtktktStartupEventMetadata(
  sheet: ExcelJS.Worksheet,
  row: Record<string, string>,
) {
  const unit = ["S1", "S2"].includes(row["KTKT:STARTUP_UNIT"])
    ? row["KTKT:STARTUP_UNIT"]
    : "";
  const eventCode = row["KTKT:STARTUP_EVENT"] || "";
  const event = eventLabels[eventCode];
  if (unit) {
    sheet.getCell("B87").value = `Công tơ dầu cấp lò ${unit}`;
    sheet.getCell("B88").value = `Công tơ dầu về lò ${unit}`;
  }
  if (event) {
    sheet.getCell("B86").value = `CÔNG TƠ DẦU CỦA LÒ${unit ? ` - ${unit}` : ""} - ${event.toUpperCase()}`;
  }
  if (eventCode !== "incident_oil") return;

  const entries = ktktEntries(row);
  const summary = calculateIncidentOilSummary(entries);
  const oilStartTime = row["KTKT:STARTUP_OIL_START_TIME"]?.trim() || "chưa nhập giờ";
  const gridSyncTime = row["KTKT:STARTUP_GRID_SYNC_TIME"]?.trim() || "chưa nhập giờ";
  const minLoadTime = row["KTKT:STARTUP_MIN_LOAD_TIME"]?.trim() || "chưa nhập giờ";
  const minLoadMw = row["KTKT:STARTUP_MIN_LOAD_MW"]?.trim();

  sheet.getCell("C86").value = `Bắt đầu đốt dầu\n${oilStartTime}`;
  sheet.getCell("D86").value = `Hòa lưới\n${gridSyncTime}`;
  sheet.getCell("E86").value = `Đạt tải min${minLoadMw ? ` ${minLoadMw} MW` : ""}\n${minLoadTime}`;
  for (const cell of ["C86", "D86", "E86"]) sheet.getCell(cell).alignment = { ...sheet.getCell(cell).alignment, wrapText: true };

  const stageValues = {
    C87: numeric(row["KTKT:C87"]), C88: numeric(row["KTKT:C88"]),
    D87: numeric(row["KTKT:E87"]), D88: numeric(row["KTKT:E88"]),
    E87: numeric(row["KTKT:D87"]), E88: numeric(row["KTKT:D88"]),
  };
  for (const [cell, value] of Object.entries(stageValues)) sheet.getCell(cell).value = value;
  for (const column of ["F", "G", "H"]) {
    sheet.getCell(`${column}86`).value = null;
    sheet.getCell(`${column}87`).value = null;
    sheet.getCell(`${column}88`).value = null;
    sheet.getCell(`${column}89`).value = null;
  }

  sheet.getCell("B89").value = "Tiêu thụ dầu chốt theo công tơ (tấn)";
  sheet.getCell("C89").value = summary.startToGridTonnes;
  sheet.getCell("D89").value = summary.gridToMinLoadTonnes;
  sheet.getCell("E89").value = summary.totalTonnes;
  if (!sheet.getCell("B90").isMerged) sheet.mergeCells("B90:H90");
  sheet.getCell("B90").value = `${unit || "Chưa chọn tổ máy"}: bắt đầu đốt dầu ${oilStartTime} → hòa lưới ${gridSyncTime}: ${display(summary.startToGridTonnes)}; hòa lưới → đạt tải min${minLoadMw ? ` ${minLoadMw} MW` : ""} lúc ${minLoadTime}: ${display(summary.gridToMinLoadTonnes)}; tổng: ${display(summary.totalTonnes)}.`;
  sheet.getCell("B90").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  sheet.getRow(90).height = 30;
}
