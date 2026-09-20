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

export const CTKTKT_TEXT_INPUT_CELLS = new Set<string>(CTKTKT_COAL_ADJUSTMENT_NOTE_FIELDS.map(field => field.cell));
export const CTKTKT_NON_WORKBOOK_INPUT_CELLS = new Set<string>(CTKTKT_TEXT_INPUT_CELLS);

export function normalizeCtktktInputValue(cell: string, rawValue: unknown) {
  const value = String(rawValue ?? "").trim();
  return CTKTKT_TEXT_INPUT_CELLS.has(cell) || cell === "T181" ? value : value.replace(",", ".");
}

export function getCtktktCoalAdjustmentNotes(row: Record<string, string>) {
  const notes: Record<string, string> = {};
  const s1 = row["KTKT:COAL_ADJ_NOTE_S1"]?.trim();
  const s2 = row["KTKT:COAL_ADJ_NOTE_S2"]?.trim();
  if (s1) for (const cell of ["W28", "Y28", "AA28"]) notes[cell] = `Lý do hiệu chỉnh S1: ${s1}`;
  if (s2) for (const cell of ["AG28", "AI28", "AK28"]) notes[cell] = `Lý do hiệu chỉnh S2: ${s2}`;
  return notes;
}

export const CTKTKT_COAL_BLEND_FIELDS = [
  { cell: "AL87", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S1 tỷ lệ trộn Ca 1 (00h-08h)", row: 87, column: 38 },
  { cell: "AL88", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S1 tỷ lệ trộn Ca 2 (08h-16h)", row: 88, column: 38 },
  { cell: "AL89", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S1 tỷ lệ trộn Ca 3 (16h-24h)", row: 89, column: 38 },
  { cell: "AL90", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S2 tỷ lệ trộn Ca 1 (00h-08h)", row: 90, column: 38 },
  { cell: "AL91", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S2 tỷ lệ trộn Ca 2 (08h-16h)", row: 91, column: 38 },
  { cell: "AL92", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S2 tỷ lệ trộn Ca 3 (16h-24h)", row: 92, column: 38 },
  { cell: "AO87", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S1 ẩm Sub bitum Ca 1 (00h-08h)", row: 87, column: 41 },
  { cell: "AO88", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S1 ẩm Sub bitum Ca 2 (08h-16h)", row: 88, column: 41 },
  { cell: "AO89", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S1 ẩm Sub bitum Ca 3 (16h-24h)", row: 89, column: 41 },
  { cell: "AO90", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S2 ẩm Sub bitum Ca 1 (00h-08h)", row: 90, column: 41 },
  { cell: "AO91", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S2 ẩm Sub bitum Ca 2 (08h-16h)", row: 91, column: 41 },
  { cell: "AO92", section: "coal_quality", sectionLabel: "Than trộn, độ ẩm và nhiệt trị", label: "S2 ẩm Sub bitum Ca 3 (16h-24h)", row: 92, column: 41 },
] as const;

export const CTKTKT_EXTRA_INPUT_FIELDS = [
  ...CTKTKT_COAL_ADJUSTMENT_FIELDS,
  ...CTKTKT_COAL_ADJUSTMENT_NOTE_FIELDS,
  ...CTKTKT_COAL_BLEND_FIELDS,
] as const;

export const CTKTKT_LEGACY_UNUSED_COAL_BLEND_CELLS = new Set([
  "AI83", "AL83", "AI84", "AL84", "AI85", "AL85",
]);
