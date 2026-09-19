from __future__ import annotations

import base64
import io
import json
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.cell.cell import MergedCell

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / ".tmp-inspect" / "ctktkt-17-09" / "CHI_TIEU_KTKT_17.09.2026_converted.xlsx"
TEMPLATE_TARGET = ROOT / "lib" / "ctktkt-template.generated.ts"
FIELDS_TARGET = ROOT / "lib" / "ctktkt-fields.generated.ts"

wb = load_workbook(SOURCE, data_only=False, read_only=False)
daily_sheets = [f"{day:02d}" for day in range(1, 32)]
coord_kinds: dict[str, Counter] = defaultdict(Counter)
coord_values: dict[str, list[object]] = defaultdict(list)

for name in daily_sheets:
    ws = wb[name]
    for row in ws.iter_rows():
        for cell in row:
            value = cell.value
            if value is None:
                kind = "blank"
            elif isinstance(value, str) and value.startswith("="):
                kind = "formula"
            elif isinstance(value, (int, float)):
                kind = "number"
            else:
                kind = "text"
            coord_kinds[cell.coordinate][kind] += 1
            if value is not None:
                coord_values[cell.coordinate].append(value)

ws = wb["17"]
skip_columns = {1, 21, 31}  # STT/helper columns A/U/AE
skip_rows = {2, 7, 23, 40, 48, 51, 53, 58}  # fixed time headers


def section(row: int) -> tuple[str, str]:
    if row <= 20:
        return "power_meters", "Công suất và công tơ chính"
    if row <= 39:
        return "fuel_meters", "Công tơ than, dầu và điện tự dùng"
    if row <= 64:
        return "water_oil", "Nước, dầu HFO và hơi"
    if row <= 79:
        return "environment", "NH3, nước demin và thời gian vận hành"
    if row <= 119:
        return "coal_quality", "Than trộn, độ ẩm và nhiệt trị"
    if row <= 154:
        return "meter_summary", "Bảng tổng hợp công tơ"
    if row <= 176:
        return "pmis_daily", "Đối chiếu PMIS theo ngày"
    return "pmis_02pd", "Báo cáo PMIS 02-PĐ"


def text(value: object) -> str:
    return " ".join(str(value or "").replace("\n", " ").split())


def label_for(cell) -> str:
    col, row = cell.column, cell.row
    anchors = []
    if 13 <= col <= 18:
        anchors.append(ws.cell(row, 12).value)
        anchors.append(ws.cell(2, col).value)
    elif 23 <= col <= 28:
        anchors.append(ws.cell(row, 22).value)
        anchors.append(ws.cell(7 if row <= 39 else 40, col).value)
    elif 33 <= col <= 38:
        anchors.append(ws.cell(row, 32).value)
        anchors.append(ws.cell(7 if row <= 39 else 40, col).value)
    elif row == 181:
        anchors.extend([ws.cell(179, col).value, ws.cell(178, col).value])
    elif row in (157, 158):
        anchors.extend([ws.cell(row, 3).value, ws.cell(156, col).value])
    else:
        for candidate_col in range(col - 1, max(0, col - 12), -1):
            value = ws.cell(row, candidate_col).value
            if isinstance(value, str) and not value.startswith("="):
                anchors.append(value)
                break
        for candidate_row in range(row - 1, max(0, row - 5), -1):
            value = ws.cell(candidate_row, col).value
            if isinstance(value, str) and not value.startswith("="):
                anchors.append(value)
                break
    parts = [text(value) for value in anchors if text(value)]
    return " · ".join(dict.fromkeys(parts)) or f"Ô {cell.coordinate}"


fields = []
for coordinate, kinds in coord_kinds.items():
    cell = ws[coordinate]
    numbers = [float(value) for value in coord_values[coordinate] if isinstance(value, (int, float))]
    distinct = {round(value, 12) for value in numbers}
    if kinds["formula"] or kinds["number"] < 3 or len(distinct) < 3:
        continue
    if cell.column in skip_columns or cell.row in skip_rows or cell.row <= 2:
        continue
    key, section_label = section(cell.row)
    fields.append({
        "cell": coordinate,
        "section": key,
        "sectionLabel": section_label,
        "label": label_for(cell),
        "row": cell.row,
        "column": cell.column,
    })

explicit = ["J157", "K157", "J158", "K158"] + [f"{column}181" for column in "CDEFGHIJKLMNOPQRST"]
known = {item["cell"] for item in fields}
for coordinate in explicit:
    if coordinate in known:
        continue
    cell = ws[coordinate]
    key, section_label = section(cell.row)
    fields.append({
        "cell": coordinate,
        "section": key,
        "sectionLabel": section_label,
        "label": label_for(cell),
        "row": cell.row,
        "column": cell.column,
    })

fields.sort(key=lambda item: (item["row"], item["column"]))

# Never commit the user's real operating figures. Build a clean template that
# retains formulas/styles/layout but removes every identified manual field and
# other literal values from operational input blocks. Saving with openpyxl also
# removes cached formula results while keeping the formulas themselves.
clear_ranges = [
    "M3:R20", "W8:AB28", "AG8:AL28", "M41:R46", "M49:R64",
    "W54:AB54", "AG54:AL54", "W68:Z74", "N69:Q75", "M81:O82",
    "W86:W89", "AJ87:AO92", "J157:L158", "C181:T181",
]
for name in ["d-1", *daily_sheets]:
    sheet = wb[name]
    for field in fields:
        target_cell = sheet[field["cell"]]
        if not isinstance(target_cell, MergedCell):
            target_cell.value = None
    for range_ref in clear_ranges:
        for row in sheet[range_ref]:
            for cell in row:
                if isinstance(cell, MergedCell):
                    continue
                if not (isinstance(cell.value, str) and cell.value.startswith("=")):
                    cell.value = None
    for target in ["Z57", "AJ57", "AE83"]:
        sheet[target].value = "Ngày vận hành"
    for target in ["N68", "O68"]:
        sheet[target].value = "Mức bồn theo ngày vận hành"

# Comments in the source are tied to legacy VML drawing parts. They may contain
# real operational notes and openpyxl cannot safely rewrite those VML links for
# ExcelJS, so the distributable template intentionally omits comments.
for sheet in wb.worksheets:
    for row in sheet.iter_rows():
        for cell in row:
            if not isinstance(cell, MergedCell) and cell.comment is not None:
                cell.comment = None

month_sheet = wb["Tổng hợp tháng"]
for row in month_sheet.iter_rows(min_row=3, max_row=26, min_col=2, max_col=40):
    for cell in row:
        if isinstance(cell.value, (int, float)):
            cell.value = None

buffer = io.BytesIO()
wb.save(buffer)
sanitized_bytes = buffer.getvalue()
cached_book = load_workbook(io.BytesIO(sanitized_bytes), data_only=True, read_only=False)
formula_cache_count = 0
for name in ["d-1", *daily_sheets, "Tổng hợp tháng"]:
    formula_sheet = wb[name]
    cached_sheet = cached_book[name]
    for row in formula_sheet.iter_rows():
        for cell in row:
            if isinstance(cell.value, str) and cell.value.startswith("=") and cached_sheet[cell.coordinate].value is not None:
                formula_cache_count += 1
if formula_cache_count:
    raise RuntimeError(f"sanitized template still contains {formula_cache_count} cached formula results")
encoded = base64.b64encode(sanitized_bytes).decode("ascii")
template_target = (
    "// Generated from the user-supplied workbook. Do not edit by hand.\n"
    f"export const CTKTKT_TEMPLATE_BASE64 = {json.dumps(encoded)};\n"
)
fields_target = (
    "// Generated from the user-supplied workbook. Do not edit by hand.\n"
    f"export const CTKTKT_INPUT_FIELDS = {json.dumps(fields, ensure_ascii=False, separators=(',', ':'))} as const;\n"
)
TEMPLATE_TARGET.write_text(template_target, encoding="utf-8")
FIELDS_TARGET.write_text(fields_target, encoding="utf-8")
print(f"generated {TEMPLATE_TARGET} and {FIELDS_TARGET} with {len(fields)} fields and {len(encoded)} base64 characters")
