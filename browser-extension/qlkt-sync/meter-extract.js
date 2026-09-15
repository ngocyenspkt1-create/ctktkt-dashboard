(() => {
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalized = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const parseNumber = raw => {
    let value = clean(raw).replace(/[\s\u00a0]/g, "").replace(/[^0-9,.-]/g, "");
    if (!value) return null;
    const comma = value.lastIndexOf(","), dot = value.lastIndexOf(".");
    if (comma >= 0 && comma > dot) value = value.replace(/\./g, "").replace(",", ".");
    else if (dot >= 0 && dot > comma) value = value.replace(/,/g, "");
    else value = value.replace(",", ".");
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const normalizeDate = raw => {
    const match = clean(raw).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
  };
  const required = [
    { meter: "DHA_S1", label: "Đầu cực S1" },
    { meter: "DH1_285M", label: "Điểm bán S1" },
    { meter: "DHA_S2", label: "Đầu cực S2" },
    { meter: "DH1_283M", label: "Điểm bán S2" },
  ];

  function extractPpaMeterReadings(tables, operatingDate, sourcePage = "QLKT · Số liệu đo đếm công tơ") {
    let header = null, dataRows = [], headerTableIndex = -1, headerRowIndex = -1;
    for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
      const rows = tables[tableIndex];
      const headerIndex = rows.findIndex(row => {
        const cells = row.map(normalized);
        return cells.includes("ten diem do") && cells.includes("kenh") && cells.includes("tong") && cells.some(cell => cell === "h1" || cell === "h01");
      });
      if (headerIndex < 0) continue;
      const candidate = rows[headerIndex].map(normalized);
      const hasAllIntervals = Array.from({ length: 48 }, (_, index) => {
        const hour = index + 1;
        return candidate.includes(`h${hour}`) || candidate.includes(`h${String(hour).padStart(2, "0")}`);
      }).every(Boolean);
      if (hasAllIntervals) { header = candidate; headerTableIndex = tableIndex; headerRowIndex = headerIndex; break; }
    }
    if (!header) throw new Error("Không tìm thấy bảng Số liệu đo đếm công tơ có đủ H1–H48.");
    dataRows = tables.flatMap((rows, tableIndex) => tableIndex === headerTableIndex ? rows.slice(headerRowIndex + 1) : rows);

    const meterIndex = header.indexOf("ten diem do"), channelIndex = header.indexOf("kenh"), dateIndex = header.indexOf("ngay"), totalIndex = header.indexOf("tong");
    const hourIndexes = Array.from({ length: 48 }, (_, index) => {
      const hour = index + 1;
      const plain = header.indexOf(`h${hour}`);
      return plain >= 0 ? plain : header.indexOf(`h${String(hour).padStart(2, "0")}`);
    });
    const readings = required.map(target => {
      const row = dataRows.find(candidate => {
        const actualMeterIndex = candidate.findIndex(cell => normalized(cell) === normalized(target.meter));
        const offset = actualMeterIndex - meterIndex;
        return actualMeterIndex >= 0 && normalized(candidate[channelIndex + offset]) === "kwhgiao"
          && (dateIndex < 0 || normalizeDate(candidate[dateIndex + offset]) === operatingDate);
      });
      if (!row) throw new Error(`Không tìm thấy ${target.meter} / kWhGiao cho ngày đã chọn.`);
      const offset = row.findIndex(cell => normalized(cell) === normalized(target.meter)) - meterIndex;
      const intervals = hourIndexes.map(index => parseNumber(row[index + offset]));
      if (intervals.some(value => value === null || value < 0)) throw new Error(`${target.meter}: thiếu hoặc sai giá trị trong H1–H48.`);
      const numericIntervals = intervals;
      const intervalTotal = numericIntervals.reduce((sum, value) => sum + value, 0);
      const reportedTotal = parseNumber(row[totalIndex + offset]);
      if (reportedTotal === null) throw new Error(`${target.meter}: không đọc được cột Tổng.`);
      const tolerance = Math.max(50, Math.abs(reportedTotal) * 0.000005);
      if (Math.abs(intervalTotal - reportedTotal) > tolerance) throw new Error(`${target.meter}: tổng H1–H48 không khớp cột Tổng.`);
      return { meter: target.meter, channel: "kWhGiao", operatingDate, total: reportedTotal, intervals: numericIntervals, sourceName: sourcePage };
    });
    return { version: 1, kind: "ppa-meter", operatingDate, sourcePage, readings };
  }

  globalThis.QlktMeterExtractor = { extractPpaMeterReadings };
})();
