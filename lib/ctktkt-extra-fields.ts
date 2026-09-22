export const CTKTKT_COAL_ADJUSTMENT_FIELDS = [
  { cell: "W28", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "S1 Ca 1 (00h-08h)", row: 28, column: 23 },
  { cell: "Y28", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "S1 Ca 2 (08h-16h)", row: 28, column: 25 },
  { cell: "AA28", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "S1 Ca 3 (16h-24h)", row: 28, column: 27 },
  { cell: "AG28", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "S2 Ca 1 (00h-08h)", row: 28, column: 33 },
  { cell: "AI28", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "S2 Ca 2 (08h-16h)", row: 28, column: 35 },
  { cell: "AK28", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "S2 Ca 3 (16h-24h)", row: 28, column: 37 },
] as const;

export const CTKTKT_COAL_ADJUSTMENT_NOTE_FIELDS = [
  { cell: "COAL_ADJ_NOTE_S1", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "Lý do hiệu chỉnh S1", row: 28, column: 29 },
  { cell: "COAL_ADJ_NOTE_S2", section: "coal_meters", sectionLabel: "Hiệu chỉnh cân than", label: "Lý do hiệu chỉnh S2", row: 28, column: 39 },
] as const;

export const CTKTKT_WATER_ADJUSTMENT_FIELDS = [
  { cell: "WATER_ADJ_S1", section: "tkd_trend", sectionLabel: "Công tơ nước demin DCS", label: "Hiệu chỉnh nước demin S1 (m³)", row: 72, column: 29 },
  { cell: "WATER_ADJ_S2", section: "tkd_trend", sectionLabel: "Công tơ nước demin DCS", label: "Hiệu chỉnh nước demin S2 (m³)", row: 73, column: 29 },
] as const;

export const CTKTKT_WATER_ADJUSTMENT_NOTE_FIELDS = [
  { cell: "WATER_ADJ_NOTE_S1", section: "tkd_trend", sectionLabel: "Công tơ nước demin DCS", label: "Lý do hiệu chỉnh nước S1", row: 72, column: 30 },
  { cell: "WATER_ADJ_NOTE_S2", section: "tkd_trend", sectionLabel: "Công tơ nước demin DCS", label: "Lý do hiệu chỉnh nước S2", row: 73, column: 30 },
] as const;

// Các ô nhập tay để trống trong workbook mẫu không xuất hiện trong
// CTKTKT_INPUT_FIELDS (danh sách sinh tự động từ workbook). Khai báo rõ tại đây
// để giao diện, API lưu và trang "Tất cả trường" dùng cùng một nguồn dữ liệu.
export const CTKTKT_BLANK_TEMPLATE_INPUT_FIELDS = [
  { cell: "I35", section: "kpi_summary", sectionLabel: "Chỉ tiêu KTKT tổng hợp", label: "Suất hao bi nghiền than", row: 35, column: 9 },

  { cell: "M15", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "P TD 21 (MW) · 06h", row: 15, column: 13 },
  { cell: "N15", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "P TD 21 (MW) · 10h", row: 15, column: 14 },
  { cell: "O15", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "P TD 21 (MW) · 14h", row: 15, column: 15 },
  { cell: "P15", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "P TD 21 (MW) · 18h", row: 15, column: 16 },
  { cell: "Q15", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "P TD 21 (MW) · 22h", row: 15, column: 17 },
  { cell: "R15", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "P TD 21 (MW) · 24h", row: 15, column: 18 },
  { cell: "M16", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "Q TD 21 (MVAr) · 06h", row: 16, column: 13 },
  { cell: "N16", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "Q TD 21 (MVAr) · 10h", row: 16, column: 14 },
  { cell: "R16", section: "power_meters", sectionLabel: "Bảng TKĐ trend DCS", label: "Q TD 21 (MVAr) · 24h", row: 16, column: 18 },

  { cell: "STARTUP_UNIT", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Tổ máy sự kiện", row: 0, column: 0 },
  { cell: "STARTUP_EVENT", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Loại sự kiện", row: 0, column: 0 },
  { cell: "STARTUP_OIL_START_TIME", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Giờ bắt đầu đốt dầu", row: 0, column: 0 },
  { cell: "STARTUP_GRID_SYNC_TIME", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Giờ hòa lưới", row: 0, column: 0 },
  { cell: "STARTUP_MIN_LOAD_TIME", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Giờ đạt tải tối thiểu", row: 0, column: 0 },
  { cell: "STARTUP_MIN_LOAD_MW", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Mức tải tối thiểu (MW)", row: 0, column: 0 },
  { cell: "C87", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò · Khởi động", row: 87, column: 3 },
  { cell: "E87", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò · Hòa lưới I", row: 87, column: 5 },
  { cell: "F87", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò · Tách lưới I", row: 87, column: 6 },
  { cell: "G87", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò · Hòa lưới II", row: 87, column: 7 },
  { cell: "H87", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò · Tách lưới II", row: 87, column: 8 },
  { cell: "C88", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò S2 · Khởi động", row: 88, column: 3 },
  { cell: "D88", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò · Ngừng đốt lò", row: 88, column: 4 },
  { cell: "E88", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò · Hòa lưới I", row: 88, column: 5 },
  { cell: "F88", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò · Tách lưới I", row: 88, column: 6 },
  { cell: "G88", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò · Hòa lưới II", row: 88, column: 7 },
  { cell: "H88", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò · Tách lưới II", row: 88, column: 8 },
  { cell: "C93", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò hơi phụ · Khởi động", row: 93, column: 3 },
  { cell: "D93", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò hơi phụ · Ngừng đốt lò", row: 93, column: 4 },
  { cell: "E93", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò hơi phụ · Hòa lưới I", row: 93, column: 5 },
  { cell: "F93", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò hơi phụ · Tách lưới I", row: 93, column: 6 },
  { cell: "G93", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò hơi phụ · Hòa lưới II", row: 93, column: 7 },
  { cell: "H93", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu cấp lò hơi phụ · Tách lưới II", row: 93, column: 8 },
  { cell: "C94", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò hơi phụ · Khởi động", row: 94, column: 3 },
  { cell: "D94", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò hơi phụ · Ngừng đốt lò", row: 94, column: 4 },
  { cell: "E94", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò hơi phụ · Hòa lưới I", row: 94, column: 5 },
  { cell: "F94", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò hơi phụ · Tách lưới I", row: 94, column: 6 },
  { cell: "G94", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò hơi phụ · Hòa lưới II", row: 94, column: 7 },
  { cell: "H94", section: "startup_shutdown", sectionLabel: "Khởi động / Ngừng tổ máy", label: "Dầu về lò hơi phụ · Tách lưới II", row: 94, column: 8 },
] as const;

export const CTKTKT_TEXT_INPUT_CELLS = new Set<string>([
  ...CTKTKT_COAL_ADJUSTMENT_NOTE_FIELDS.map(field => field.cell),
  ...CTKTKT_WATER_ADJUSTMENT_NOTE_FIELDS.map(field => field.cell),
  "STARTUP_UNIT",
  "STARTUP_EVENT",
  "STARTUP_OIL_START_TIME",
  "STARTUP_GRID_SYNC_TIME",
  "STARTUP_MIN_LOAD_TIME",
]);
export const CTKTKT_NON_WORKBOOK_INPUT_CELLS = new Set<string>([
  ...CTKTKT_TEXT_INPUT_CELLS,
  ...CTKTKT_WATER_ADJUSTMENT_FIELDS.map(field => field.cell),
  "STARTUP_UNIT",
  "STARTUP_EVENT",
  "STARTUP_OIL_START_TIME",
  "STARTUP_GRID_SYNC_TIME",
  "STARTUP_MIN_LOAD_TIME",
  "STARTUP_MIN_LOAD_MW",
]);

export function normalizeCtktktInputValue(cell: string, rawValue: unknown) {
  const value = String(rawValue ?? "").trim();
  return CTKTKT_TEXT_INPUT_CELLS.has(cell) || cell === "T181"
    ? value
    : value.replace(/\s+/g, "").replace(",", ".");
}

export function getCtktktCoalAdjustmentNotes(row: Record<string, string>) {
  const notes: Record<string, string> = {};
  const s1 = row["KTKT:COAL_ADJ_NOTE_S1"]?.trim();
  const s2 = row["KTKT:COAL_ADJ_NOTE_S2"]?.trim();
  if (s1) for (const cell of ["W28", "Y28", "AA28"]) notes[cell] = `Lý do hiệu chỉnh S1: ${s1}`;
  if (s2) for (const cell of ["AG28", "AI28", "AK28"]) notes[cell] = `Lý do hiệu chỉnh S2: ${s2}`;
  return notes;
}

export function getCtktktWaterAdjustments(row: Record<string, string>) {
  const parseNum = (v?: string) => {
    if (!v) return 0;
    const n = Number(v.trim().replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    adjS1: parseNum(row["KTKT:WATER_ADJ_S1"]),
    adjS2: parseNum(row["KTKT:WATER_ADJ_S2"]),
    noteS1: row["KTKT:WATER_ADJ_NOTE_S1"]?.trim() || "",
    noteS2: row["KTKT:WATER_ADJ_NOTE_S2"]?.trim() || "",
  };
}

export const CTKTKT_COAL_BLEND_FIELDS = [] as const;

export const CTKTKT_EXTRA_INPUT_FIELDS = [
  ...CTKTKT_BLANK_TEMPLATE_INPUT_FIELDS,
  ...CTKTKT_COAL_ADJUSTMENT_FIELDS,
  ...CTKTKT_COAL_ADJUSTMENT_NOTE_FIELDS,
  ...CTKTKT_WATER_ADJUSTMENT_FIELDS,
  ...CTKTKT_WATER_ADJUSTMENT_NOTE_FIELDS,
  ...CTKTKT_COAL_BLEND_FIELDS,
] as const;

export const CTKTKT_LEGACY_UNUSED_COAL_BLEND_CELLS = new Set([
  "AI83", "AL83", "AI84", "AL84", "AI85", "AL85",
  "AL87", "AL88", "AL89", "AL90", "AL91", "AL92",
  "AN87", "AN88", "AN89", "AN90", "AN91", "AN92",
  "AO87", "AO88", "AO89", "AO90", "AO91", "AO92",
]);
