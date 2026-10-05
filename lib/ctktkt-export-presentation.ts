import type ExcelJS from "exceljs";

const white: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
const yellow: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

/** Presentation only: never change readings, formulas, cached results or number formats. */
export function applyCtktktExportPresentation(workbook: ExcelJS.Workbook) {
  for (const sheet of workbook.worksheets) {
    sheet.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { ...cell.font, name: "Times New Roman", family: 1, scheme: undefined };
      if (cell.value && typeof cell.value === "object" && "richText" in cell.value) {
        cell.value = { ...cell.value, richText: cell.value.richText.map(run => ({
          ...run, font: { ...run.font, name: "Times New Roman", family: 1, scheme: undefined },
        })) };
      }
      if (cell.value === null || cell.value === "") cell.fill = white;
    }));

    // The replacement event table exists only on daily report sheets.
    if (!/^\d{2}$/.test(sheet.name)) continue;
    for (let row = 59; row <= 83; row += 1) {
      for (let column = 2; column <= 10; column += 1) {
        const cell = sheet.getRow(row).getCell(column);
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        cell.font = {
          ...cell.font, name: "Times New Roman", size: 9,
          bold: row === 59 || column === 2, italic: false, color: { argb: "FF000000" },
        };
        cell.fill = row === 59 ? yellow : white;
        cell.alignment = {
          ...cell.alignment, horizontal: row === 59 || column > 2 ? "center" : "left",
          vertical: "middle", wrapText: true,
        };
      }
    }
    sheet.getRow(59).height = Math.max(sheet.getRow(59).height || 0, 48);
  }
}
