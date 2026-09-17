// Shared constants + Excel-export builder for the "Nhập liệu BCSX" module.
//
// Context: trưởng ca (shift lead) currently retypes the same half-hourly P/Q
// readings and the daily operating-event log by hand into 3 near-identical
// Excel files every day (BCSX_NMD_A0/S1/S2 — sent to Điều độ NSMO). This module
// lets them type it once on the web (per unit S1/S2 — A0 = tổng nhà máy is
// always S1+S2, computed, never entered separately) and export files that
// match the original template layout exactly, so the receiving side's
// workflow (open the file, forward by email) does not change.
//
// The 4 end-of-day totals (Sản lượng đầu cực/thương phẩm/than tiêu thụ, than
// tồn kho) live in `daily_inputs`, reusing the existing QLKT-sync field codes
// (B/C/AE for S1, H/I/AF for S2, AR for than tồn kho, shared across units) —
// same codes the "/" page already syncs/edits, entering them here or there
// writes to the same place. The user intends to wire a QLKT auto-sync
// specifically for this page once they confirm the exact source screen; until
// then these are plain editable inputs. "Tự dùng" = đầu cực - thương phẩm
// (computed, matches the source workbook's own formula, never entered).
//
// "Tình hình vận hành" (operating-event log) is meant to come from QLKT too,
// per the user — also pending the exact source; manual add/remove stays as
// the interim/override UI.
//
// A0 (tổng nhà máy) rules, per explicit user instruction (17/09/2026):
//   - Mục 1 (48 điểm nửa giờ): tổng S1+S2 tại TỪNG ô tương ứng, không có ngoại
//     lệ (kể cả cột điện áp thanh cái).
//   - Mục 2 (5 số tổng ngày): tổng S1+S2 — NGOẠI TRỪ than tồn kho, là 1 kho
//     dùng chung cho cả nhà máy (không cộng đôi) — người dùng xác nhận 17/09/2026.
//   - Mục 3 (nhật ký sự kiện): các dòng của S1 đứng trước, S2 tiếp theo sau —
//     KHÔNG sắp xếp lại theo thời gian.

export type Unit = "S1" | "S2";
export type ExportUnit = Unit | "A0";

// 48 half-hour points, 00:30 → 23:30, plus a final "23:59" end-of-day point —
// verified against the real BCSX_NMD_S1_16.09.2026.xlsx column A (rows 11-58).
export const SHIFT_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let minutes = 30; minutes < 24 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  slots[slots.length - 1] = "23:59"; // last point is labeled 23:59, not 24:00
  return slots;
})();

export type ShiftMetric = "P" | "Q" | "D" | "E";
export const SHIFT_METRICS: { key: ShiftMetric; label: string; col: "B" | "C" | "D" | "E" }[] = [
  { key: "P", label: "Tổng P (MW) đầu cực máy phát", col: "B" },
  { key: "Q", label: "Tổng Q (MVAr) đầu cực máy phát", col: "C" },
  { key: "D", label: "Tổng P (MW) điểm bán điện", col: "D" },
  { key: "E", label: "Điện áp thanh cái (kV)", col: "E" },
];

// Legend from the source file (cols J/K, rows 73-77 of the day sheet) — kept
// verbatim so the exported "Loại sự kiện" column matches the original codes.
export const EVENT_TYPES: { code: number; label: string }[] = [
  { code: 1, label: "Bình thường: tăng giảm công suất theo lệnh điều độ" },
  { code: 2, label: "Đốt lò, khởi động, hòa lưới, ngừng tổ máy theo lệnh điều độ" },
  { code: 3, label: "Tách sửa chữa, đưa vào dự phòng sau sửa chữa tổ máy" },
  { code: 4, label: "Bất thường: các cảnh báo quá tải, điện áp cao hoặc thấp, nhiệt độ cao ... " },
  { code: 5, label: "Sự cố: ngừng sự cố tổ máy do bảo vệ tác động" },
];

export type OperatingEvent = {
  id?: number;
  startAt: string; // "YYYY-MM-DD HH:mm"
  endAt: string; // "YYYY-MM-DD HH:mm" or ""
  eventType: number; // 1..5
  description: string;
};

export type UnitTotals = { dauCuc: number | null; thuongPham: number | null; thanTieuThu: number | null; thanTonKho: number | null };

export type BcsxExportInput = {
  operatingDate: string; // YYYY-MM-DD
  unit: ExportUnit;
  readings: Partial<Record<ShiftMetric, (number | null)[]>>; // 48 values per metric, in SHIFT_TIME_SLOTS order
  totals: UnitTotals; // đầu cực/thương phẩm/than tiêu thụ/than tồn kho — tự dùng computed
  events: OperatingEvent[];
};

export function datePartsVN(operatingDate: string) {
  const [y, m, d] = operatingDate.split("-");
  return `${d}/${m}/${y}`;
}

export async function buildBcsxWorkbook(input: BcsxExportInput): Promise<ArrayBuffer> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = (ExcelJSModule.default ?? ExcelJSModule) as typeof ExcelJSModule.default;
  const { BCSX_TEMPLATE_S1_BASE64, BCSX_TEMPLATE_S2_BASE64, BCSX_TEMPLATE_A0_BASE64 } = await import("./bcsx-templates.generated");
  const base64 = input.unit === "S1" ? BCSX_TEMPLATE_S1_BASE64 : input.unit === "S2" ? BCSX_TEMPLATE_S2_BASE64 : BCSX_TEMPLATE_A0_BASE64;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer);
  const ws = workbook.getWorksheet("BCSX");
  if (!ws) throw new Error("Không tìm thấy sheet mẫu BCSX trong file template.");

  for (const metric of SHIFT_METRICS) {
    const values = input.readings[metric.key];
    if (!values) continue;
    for (let i = 0; i < SHIFT_TIME_SLOTS.length; i++) {
      const value = values[i];
      if (value === null || value === undefined || Number.isNaN(value)) continue;
      ws.getCell(`${metric.col}${11 + i}`).value = value;
    }
  }

  const tuDung = input.totals.dauCuc !== null && input.totals.thuongPham !== null ? input.totals.dauCuc - input.totals.thuongPham : null;
  const totalCells: [string, number | null][] = [
    ["C60", input.totals.dauCuc],
    ["C61", input.totals.thuongPham],
    ["C62", tuDung],
    ["C63", input.totals.thanTieuThu],
    ["C64", input.totals.thanTonKho],
  ];
  for (const [coord, value] of totalCells) if (value !== null) ws.getCell(coord).value = value;

  // Events are written in the order the caller already put them in — for S1/S2
  // that's chronological (DB query orders by start_at); for A0 the caller
  // concatenates S1's rows followed by S2's rows (not time-interleaved), per
  // the user's explicit instruction, so do NOT re-sort here.
  input.events.forEach((event, i) => {
    const row = 72 + i;
    ws.getCell(`A${row}`).value = formatEventTimestamp(event.startAt);
    ws.getCell(`B${row}`).value = event.endAt ? formatEventTimestamp(event.endAt) : "";
    ws.getCell(`C${row}`).value = event.eventType;
    ws.getCell(`D${row}`).value = event.description;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

function formatEventTimestamp(value: string) {
  // value is "YYYY-MM-DD HH:mm" — the source file uses "MM/DD/YYYY HH:mm".
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return value;
  const [, y, mo, d, h, mi] = m;
  return `${mo}/${d}/${y} ${h}:${mi}`;
}

export function fileNameFor(unit: ExportUnit, operatingDate: string) {
  const [y, m, d] = operatingDate.split("-");
  return `BCSX_NMD_${unit}_${d}.${m}.${y}.xlsx`;
}
