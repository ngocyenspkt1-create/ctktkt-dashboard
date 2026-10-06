import type * as XLSX from "xlsx";

/** Match HFO tank labels rather than assuming historical files use today's row numbers. */
export function ctktktHistoryHfoCellMap(sheet: XLSX.WorkSheet) {
  const levels = new Map<number, number>();
  const temperatures = new Map<number, number>();
  for (let row = 40; row <= 85; row += 1) {
    const label = String(sheet[`L${row}`]?.v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("đ", "d").toLowerCase().replace(/\s+/g, " ").trim();
    const level = /^muc bon (?:dau )?hfo\s*([1-5])\b/.exec(label);
    const temperature = /^bon (?:dau )?hfo\s*([1-5])\b/.exec(label);
    const match = level || temperature;
    if (!match) continue;
    const rows = level ? levels : temperatures;
    const tank = Number(match[1]);
    if (rows.has(tank)) throw new Error(`Bảng HFO có nhiều dòng cùng nhãn bồn ${tank}; chưa thể xác định đúng ô số liệu.`);
    rows.set(tank, row);
  }
  const map = new Map<string, string | null>();
  for (const [rows, start] of [[levels, 52], [temperatures, 60]] as const) {
    if (!rows.size) continue;
    for (let tank = 1; tank <= 5; tank += 1) for (const column of ["M", "N", "O", "P", "Q", "R"]) {
      const sourceRow = rows.get(tank);
      map.set(`${column}${start + tank - 1}`, sourceRow ? `${column}${sourceRow}` : null);
    }
  }
  return map;
}
