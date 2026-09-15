(() => {
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalized = value => clean(value).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const parseNumber = raw => {
    let value = clean(raw).replace(/[\s ]/g, "").replace(/[^0-9,.-]/g, "");
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

  // --- Cách 1 (dự phòng): dò bảng HTML đã hiển thị đủ cột H1–H48 trong DOM.
  // Trang QLKT thật thường KHÔNG render đủ 48 cột cùng lúc (bảng ảo hoá theo
  // chiều ngang lẫn chiều dọc), nên cách này chỉ còn dùng khi cách 2 thất bại.
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

  // --- Cách 2 (chính): đọc thẳng dữ liệu đầy đủ mà QLKT đã nhúng sẵn trong
  // trang, bên trong thẻ <script> khởi tạo widget bảng tính "ExtSheet"
  // (PrimeFaces Extensions). Widget này chỉ HIỂN THỊ một phần nhỏ số cột/dòng
  // cùng lúc (ảo hoá để tăng tốc độ), nhưng toàn bộ dữ liệu — kể cả 48 cột
  // H1–H48 của mọi điểm đo — luôn có sẵn nguyên vẹn dưới dạng mảng JSON ngay
  // trong mã nguồn trang, không phụ thuộc việc người dùng đã cuộn/hiển thị
  // tới đâu. Đây là lý do cách đọc bảng DOM (cách 1) hay báo "không tìm thấy
  // đủ H1–H48": trình duyệt chỉ vẽ ra một phần bảng, còn dữ liệu thật nằm ở
  // đây.
  function extractDataArraysFromScripts(scriptTexts) {
    const arrays = [];
    for (const text of scriptTexts) {
      if (typeof text !== "string" || text.indexOf("ExtSheet") < 0 || text.indexOf("data:[") < 0) continue;
      let searchFrom = 0;
      for (;;) {
        const dataKeyIndex = text.indexOf("data:[", searchFrom);
        if (dataKeyIndex < 0) break;
        const arrStart = dataKeyIndex + "data:".length;
        let depth = 0, i = arrStart, inString = false, quoteChar = "";
        for (; i < text.length; i += 1) {
          const character = text[i];
          if (inString) {
            if (character === "\\") { i += 1; continue; }
            if (character === quoteChar) inString = false;
            continue;
          }
          if (character === '"' || character === "'") { inString = true; quoteChar = character; continue; }
          if (character === "[") depth += 1;
          else if (character === "]") { depth -= 1; if (depth === 0) { i += 1; break; } }
        }
        const arrayText = text.slice(arrStart, i);
        try {
          const parsed = JSON.parse(arrayText);
          if (Array.isArray(parsed)) arrays.push(parsed);
        } catch {
          // Đoạn không parse được (không phải JSON hợp lệ) thì bỏ qua, thử đoạn "data:[" tiếp theo nếu có.
        }
        searchFrom = Math.max(i, dataKeyIndex + 6);
      }
    }
    return arrays;
  }

  function extractPpaMeterReadingsFromScripts(scriptTexts, operatingDate, sourcePage = "QLKT · Số liệu đo đếm công tơ") {
    const arrays = extractDataArraysFromScripts(scriptTexts);
    if (!arrays.length) {
      // Ghi thêm thông tin chẩn đoán vào thông báo lỗi để không cần dò lại
      // thủ công lần nữa nếu vẫn thất bại: đã quét bao nhiêu thẻ <script>,
      // bao nhiêu thẻ có chữ "ExtSheet", bao nhiêu thẻ có "data:[".
      const total = scriptTexts.length;
      const withExtSheet = scriptTexts.filter(text => typeof text === "string" && text.indexOf("ExtSheet") >= 0).length;
      const withDataKey = scriptTexts.filter(text => typeof text === "string" && text.indexOf("data:[") >= 0).length;
      throw new Error(`Không tìm thấy dữ liệu bảng công tơ (ExtSheet) trong mã nguồn trang. (Đã quét ${total} thẻ script; ${withExtSheet} thẻ có "ExtSheet"; ${withDataKey} thẻ có "data:[").`);
    }
    const rows = arrays.flat().filter(row => Array.isArray(row) && row.length >= 53);
    if (!rows.length) throw new Error(`Không tìm thấy dòng dữ liệu điểm đo hợp lệ trong bảng công tơ. (Tìm thấy ${arrays.length} mảng dữ liệu nhưng không dòng nào đủ cột.)`);

    const readings = required.map(target => {
      const row = rows.find(candidate => {
        if (normalized(candidate[1]) !== "kwhgiao") return false;
        if (normalized(candidate[0]) !== normalized(target.meter)) return false;
        const rowDate = normalizeDate(candidate[2]);
        if (rowDate && rowDate !== operatingDate) return false;
        return true;
      });
      if (!row) {
        const meterRowsAnyChannel = rows.filter(candidate => normalized(candidate[0]) === normalized(target.meter));
        const channelsFound = [...new Set(meterRowsAnyChannel.map(candidate => candidate[1]))];
        const datesFound = [...new Set(meterRowsAnyChannel.map(candidate => candidate[2]))];
        throw new Error(`Không tìm thấy ${target.meter} / kWhGiao cho ngày đã chọn. (Tìm thấy ${meterRowsAnyChannel.length} dòng của ${target.meter}, kênh: ${channelsFound.join(", ") || "không có"}; ngày: ${datesFound.join(", ") || "không có"}.)`);
      }
      const intervals = row.slice(row.length - 48).map(parseNumber);
      if (intervals.some(value => value === null || value < 0)) throw new Error(`${target.meter}: thiếu hoặc sai giá trị trong H1–H48.`);
      const intervalTotal = intervals.reduce((sum, value) => sum + value, 0);
      const reportedTotal = parseNumber(row[row.length - 49]);
      if (reportedTotal === null) throw new Error(`${target.meter}: không đọc được cột Tổng.`);
      const tolerance = Math.max(50, Math.abs(reportedTotal) * 0.000005);
      if (Math.abs(intervalTotal - reportedTotal) > tolerance) throw new Error(`${target.meter}: tổng H1–H48 không khớp cột Tổng.`);
      return { meter: target.meter, channel: "kWhGiao", operatingDate, total: reportedTotal, intervals, sourceName: sourcePage };
    });
    return { version: 1, kind: "ppa-meter", operatingDate, sourcePage, readings };
  }

  function extractPpaMeterReadingsFromDataArrays(arrays, operatingDate, sourcePage = "QLKT · Số liệu đo đếm công tơ") {
    const scriptTexts = (Array.isArray(arrays) ? arrays : []).map(data => `ExtSheet data:${JSON.stringify(data)}`);
    return extractPpaMeterReadingsFromScripts(scriptTexts, operatingDate, sourcePage);
  }

  globalThis.QlktMeterExtractor = { extractPpaMeterReadings, extractPpaMeterReadingsFromScripts, extractPpaMeterReadingsFromDataArrays };
})();
