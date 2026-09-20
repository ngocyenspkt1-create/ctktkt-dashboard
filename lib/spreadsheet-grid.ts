export function normalizeSpreadsheetValue(raw: string) {
  const text = raw.trim().replace(/[\u00a0\u202f\s]+/g, "");
  if (!text || text === "-" || text === "–" || text === "—") return "";
  if (!/^[+-]?[\d.,]+$/.test(text)) return raw.trim();

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    return comma > dot
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  }
  if (comma >= 0) {
    const parts = text.split(",");
    return parts.length === 2 ? `${parts[0]}.${parts[1]}` : text.replace(/,/g, "");
  }
  if ((text.match(/\./g) || []).length > 1) return text.replace(/\./g, "");
  return text;
}

export function parseSpreadsheetClipboard(text: string) {
  const rows = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  if (rows.at(-1) === "") rows.pop();

  let matrix = rows.map(line => line.split("\t"));
  const hasLeadingLabel = matrix.length > 0 && matrix.every(row => {
    if (row.length < 2) return false;
    const first = normalizeSpreadsheetValue(row[0]);
    const second = normalizeSpreadsheetValue(row[1]);
    return first !== "" && !Number.isFinite(Number(first)) && second !== "" && Number.isFinite(Number(second));
  });
  if (hasLeadingLabel) matrix = matrix.map(row => row.slice(1));
  return matrix.map(row => row.map(normalizeSpreadsheetValue));
}
