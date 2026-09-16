(() => {
  const cleanText = value => String(value || "").replace(/\s+/g, " ").trim();
  const normalized = value => cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const readValue = input => cleanText(input.value || input.getAttribute("value") || "");
  const parseNumber = raw => {
    const original = cleanText(raw);
    if (/[A-Za-zÀ-ỹ]/u.test(original) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(original)) return null;
    let value = original.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
    if (!value) return null;
    const comma = value.lastIndexOf(","), dot = value.lastIndexOf(".");
    if (comma >= 0 && comma > dot) value = value.replace(/\./g, "").replace(",", ".");
    else if (dot >= 0 && dot > comma) value = value.replace(/,/g, "");
    else value = value.replace(",", ".");
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : null;
  };
  const parseDate = () => {
    const values = [...document.querySelectorAll("input")].map(readValue);
    for (const value of values) {
      const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
    return null;
  };

  function pageKind() {
    const path = location.pathname.toLowerCase();
    if (path.includes("rpt_a_production_day")) return "production";
    if (path.includes("nhienlieu")) return "fuel";
    if (path.includes("hieusuatlo") || path.includes("suathaonhiet") || path.includes("can_bang_nhiet")) return "heatrate";
    const page = normalized(document.body?.innerText);
    if (page.includes("so lieu do dem cong to") && page.includes("nguon du lieu") && page.includes("kwhgiao")) return "meter";
    if (page.includes("dien nang dau cuc") && page.includes("sl diem ban")) return "production";
    if (page.includes("nhien lieu than") && page.includes("nhien lieu dau fo")) return "fuel";
    if (page.includes("so gio phat") && page.includes("luy ke so gio van hanh")) return "operation";
    if (page.includes("hieu suat lo") && page.includes("suat hao nhiet")) return "heatrate";
    return null;
  }

  function rememberPage() {
    const kind = pageKind();
    if (!kind) return;
    chrome.storage.local.get({ qlktPages: {} }, ({ qlktPages }) => {
      const pageUrl = `${location.origin}${location.pathname}${location.search}`;
      if (qlktPages[kind] === pageUrl) return;
      chrome.storage.local.set({ qlktPages: { ...qlktPages, [kind]: pageUrl } });
    });
  }

  function prepareDate(operatingDate) {
    const match = String(operatingDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error("Ngày báo cáo không hợp lệ.");
    const displayDate = `${match[3]}/${match[2]}/${match[1]}`;
    const visibleDateInputs = [...document.querySelectorAll("input")]
      .filter(input => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(readValue(input)))
      .map(input => ({ input, rect: input.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    if (!visibleDateInputs.length) throw new Error("Không tìm thấy ô ngày báo cáo trên màn hình QLKT.");
    const firstRowTop = Math.min(...visibleDateInputs.map(({ rect }) => rect.top));
    const dateInputs = visibleDateInputs.filter(({ rect }) => Math.abs(rect.top - firstRowTop) < 24).map(({ input }) => input);
    const changed = dateInputs.some(input => readValue(input) !== displayDate);
    dateInputs.forEach(input => {
      input.focus();
      input.value = displayDate;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    });
    if (!changed) return { refreshed: false };
    const refreshIcon = document.querySelector(".ui-icon-refresh, [class*='icon-refresh'], [class*='refresh-icon'], [class*='arrowrefresh'], img[src*='refresh' i], img[src*='reload' i]");
    const labelledControl = [...document.querySelectorAll("button, a, input[type='button'], input[type='image'], input[type='submit'], input[type='reset'], [role='button']")].find(element => {
      const label = normalized(`${element.textContent} ${element.getAttribute("title") || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("alt") || ""} ${element.getAttribute("src") || ""} ${element.className || ""}`);
      return label.includes("lam moi") || label.includes("refresh") || label.includes("reload") || label.includes("arrowrefresh");
    });
    const dateRect = dateInputs[dateInputs.length - 1].getBoundingClientRect();
    const nearbyControl = [...document.querySelectorAll("button, a, input[type='button'], input[type='image'], input[type='submit'], input[type='reset'], img, [role='button'], [onclick]")]
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => {
        if (!rect.width || !rect.height) return false;
        const label = normalized(`${element.textContent} ${element.getAttribute("title") || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("alt") || ""} ${element.getAttribute("src") || ""} ${element.className || ""}`);
        const sameLine = Math.abs((rect.top + rect.height / 2) - (dateRect.top + dateRect.height / 2)) < 24;
        const toTheRight = rect.left >= dateRect.right - 4 && rect.left - dateRect.right < 180;
        const excluded = label.includes("calendar") || label.includes("datepicker") || label.includes("cal-btn") || label.includes("calbutton") || label.includes("ghi") || label.includes("save") || label.includes("xuat") || label.includes("export");
        return sameLine && toTheRight && !excluded;
      })
      .sort((left, right) => left.rect.left - right.rect.left)[0]?.element;
    const refreshControl = refreshIcon?.closest("button, a, input, [role='button'], [onclick]") || refreshIcon || labelledControl || nearbyControl;
    if (!refreshControl) throw new Error("Không tìm thấy nút cập nhật ngày trên màn hình QLKT.");
    refreshControl.click();
    return { refreshed: true };
  }

  function inputsWithContext(table) {
    const matrix = [], records = [];
    [...table.rows].forEach((row, rowIndex) => {
      matrix[rowIndex] ||= [];
      let column = 0;
      [...row.cells].forEach(cell => {
        while (matrix[rowIndex][column]) column++;
        const rowSpan = Math.max(1, Number(cell.rowSpan) || 1), colSpan = Math.max(1, Number(cell.colSpan) || 1);
        const info = { cell, rowIndex, column, rowSpan, colSpan, text: cleanText(cell.textContent) };
        records.push(info);
        for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
          matrix[r] ||= [];
          for (let c = column; c < column + colSpan; c++) matrix[r][c] = info;
        }
        column += colSpan;
      });
    });
    const result = [];
    records.forEach(record => {
      const inputs = [...record.cell.querySelectorAll("input")].filter(input => !["checkbox", "radio", "hidden", "button", "submit"].includes((input.type || "text").toLowerCase()));
      inputs.forEach(input => {
        const headers = [], seen = new Set();
        for (let row = 0; row < record.rowIndex; row++) {
          const above = matrix[row]?.[record.column];
          if (above && above !== record && !seen.has(above) && above.text) { seen.add(above); headers.push(above.text); }
        }
        const rowLabels = records.filter(item => item.rowIndex === record.rowIndex && item.column < record.column && item.text).map(item => item.text);
        result.push({ input, value: parseNumber(readValue(input)), header: normalized(headers.join(" ")), row: normalized(rowLabels.join(" ")), rawHeader: headers.join(" · "), rawRow: rowLabels.join(" · ") });
      });
    });
    return result;
  }

  // Màn hình "Tính toán hiệu suất lò/suất hao nhiệt" (Cân bằng nhiệt) hiển thị 1 bảng PrimeFaces có
  // cột đóng băng (frozen columns) — thực chất là 2 <table> tách rời nhưng CÙNG CHỈ SỐ HÀNG:
  //  - Bảng "nhãn" (cột trái): STT | Tên đại lượng | Ký hiệu | ĐVT | TK/PT test | Hệ số liên hệ.
  //  - Bảng "giá trị" (cuộn ngang): Ca sáng | Ca chiều | Ca khuya | Trung bình (mỗi hàng ứng với
  //    đúng 1 đại lượng, cùng thứ tự hàng như bảng nhãn).
  // Nhờ vậy chỉ cần dò đúng CỘT theo tên (Ký hiệu / Trung bình) rồi khớp theo Ký hiệu chính xác (PG,
  // L1, Pbn, T) thay vì đoán tên hàng — đáng tin cậy hơn nhiều so với dò theo nhãn tiếng Việt.
  // PrimeFaces vẽ riêng 1 bảng "chỉ có dòng tiêu đề" (để giữ cố định khi cuộn) TÁCH KHỎI bảng dữ
  // liệu thật — cả 2 đều khớp cùng tên cột, nên phải chọn bảng có NHIỀU HÀNG NHẤT trong số các bảng
  // khớp (bảng tiêu đề giả chỉ có 1–2 hàng), nếu không sẽ vô tình vớ phải bảng rỗng không có dữ liệu.
  function findColumnTableByHeader(headerNames) {
    let best = null;
    for (const table of document.querySelectorAll("table")) {
      for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
        const cells = [...table.rows[rowIndex].cells].map(cell => normalized(cell.textContent));
        if (headerNames.every(name => cells.includes(name)) && (!best || table.rows.length > best.table.rows.length)) {
          best = { table, headerRowIndex: rowIndex, headerCells: cells };
        }
      }
    }
    return best;
  }

  // Tổ máy đang xem trên màn hình QLKT (DH1_MF1/DH1_MF2) được chọn qua dropdown
  // "formMain:cbSelectMainAsset" (đã xác nhận trực tiếp trên hệ thống QLKT thật) — nhưng vẫn dò theo
  // kiểu chung (mọi <select> đang chọn, không khoá cứng id) để không vỡ nếu QLKT đổi id.
  function detectHeatRateUnit() {
    for (const select of document.querySelectorAll("select")) {
      const optionText = normalized(select.options?.[select.selectedIndex]?.textContent || "");
      if (!optionText) continue;
      if (optionText.includes("mf2")) return "2";
      if (optionText.includes("mf1")) return "1";
    }
    return null;
  }

  // Dropdown "Tổ máy" (formMain:cbSelectMainAsset) — dò theo kiểu chung (mọi <select> có cả 2 lựa
  // chọn MF1/MF2 trong danh sách) để không vỡ nếu QLKT đổi id, khác với detectHeatRateUnit() ở trên
  // vốn chỉ đọc lựa chọn ĐANG chọn chứ không cần liệt kê toàn bộ option.
  function findMainAssetSelect() {
    for (const select of document.querySelectorAll("select")) {
      const optionTexts = [...select.options].map(option => normalized(option.textContent || ""));
      if (optionTexts.some(text => text.includes("mf1")) && optionTexts.some(text => text.includes("mf2"))) return select;
    }
    return null;
  }

  // Dùng nội dung cột "Trung bình" làm "chữ ký" bảng — QLKT nạp lại dữ liệu bằng AJAX (PrimeFaces)
  // khi đổi Tổ máy, không đổi URL và cũng không có sự kiện "load" rõ ràng để chờ, nên phải so sánh
  // nội dung trước/sau để biết khi nào bảng đã thực sự cập nhật xong.
  function sampleHeatRateSignature() {
    const values = findColumnTableByHeader(["trung binh"]);
    return values ? [...values.table.rows].map(row => cleanText(row.textContent)).join("|") : "";
  }

  async function switchHeatRateUnit(targetUnit) {
    const select = findMainAssetSelect();
    if (!select) throw new Error("Không tìm thấy danh sách chọn Tổ máy trên màn hình này.");
    const targetOption = [...select.options].find(option => normalized(option.textContent || "").includes(`mf${targetUnit}`));
    if (!targetOption) throw new Error(`Không tìm thấy Tổ máy DH1_MF${targetUnit} trong danh sách chọn.`);
    if (select.value === targetOption.value) return;
    const before = sampleHeatRateSignature();
    select.value = targetOption.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (detectHeatRateUnit() === targetUnit && sampleHeatRateSignature() !== before) return;
    }
    throw new Error(`Màn hình chưa nạp xong dữ liệu Tổ máy DH1_MF${targetUnit} sau khi chuyển — hãy thử đồng bộ lại.`);
  }

  // 4 chỉ tiêu mới của báo cáo "THEO PMIS" (Trung bình công suất đầu cực, Tổn thất khói khô trung
  // bình, Trung bình chân không bình ngưng, Trung bình nhiệt độ nước làm mát tuần hoàn) đọc từ cột
  // "Trung bình" của bảng kết quả, khớp đúng hàng theo Ký hiệu (PG/L1/Pbn/T) — đã đối chiếu trực
  // tiếp với màn hình QLKT thật (Vận hành › Tính toán hiệu suất lò/suất hao nhiệt, "Theo Ngày").
  function readHeatRateEntriesForCurrentUnit(unit) {
    const labels = findColumnTableByHeader(["ky hieu", "ten dai luong"]);
    if (!labels) throw new Error("Không tìm thấy bảng \"Ký hiệu\" chỉ tiêu trên màn hình này.");
    const values = findColumnTableByHeader(["trung binh"]);
    if (!values) throw new Error("Không tìm thấy cột \"Trung bình\" trên màn hình này — hãy chắc chắn đang chọn \"Theo Ngày\".");
    const symbolColumn = labels.headerCells.indexOf("ky hieu");
    const avgColumn = values.headerCells.indexOf("trung binh");
    const codeByMetric = unit === "2" ? { PG: "DB", L1: "DD", Pbn: "DF", T: "DH" } : { PG: "DA", L1: "DC", Pbn: "DE", T: "DG" };
    const entries = [];
    for (const [symbol, fieldCode] of Object.entries(codeByMetric)) {
      let rowIndex = -1;
      for (let index = 0; index < labels.table.rows.length; index++) {
        const cell = labels.table.rows[index].cells[symbolColumn];
        if (cell && cleanText(cell.textContent) === symbol) { rowIndex = index; break; }
      }
      if (rowIndex === -1) continue;
      const valueCell = values.table.rows[rowIndex]?.cells[avgColumn];
      const value = valueCell ? parseNumber(valueCell.textContent) : null;
      if (value === null) continue;
      entries.push({ fieldCode, value, sourceLabel: `QLKT · DH1_MF${unit} · Trung bình` });
    }
    return entries;
  }

  // Đọc cả 2 Tổ máy (S1+S2) trong 1 lần gọi: đọc Tổ máy đang chọn trước, rồi tự chuyển dropdown
  // "Tổ máy" sang Tổ máy còn lại, chờ bảng nạp lại xong (AJAX), đọc tiếp, rồi khôi phục lại đúng
  // Tổ máy ban đầu — để người dùng chỉ cần bấm 1 nút đồng bộ trên web Chỉ tiêu KTKT.
  async function extractHeatRatePayload(operatingDate) {
    const originalUnit = detectHeatRateUnit();
    if (!originalUnit) throw new Error("Không xác định được Tổ máy (DH1_MF1/DH1_MF2) đang chọn trên màn hình QLKT.");
    const otherUnit = originalUnit === "2" ? "1" : "2";
    const entriesByUnit = { [originalUnit]: readHeatRateEntriesForCurrentUnit(originalUnit) };
    try {
      await switchHeatRateUnit(otherUnit);
      entriesByUnit[otherUnit] = readHeatRateEntriesForCurrentUnit(otherUnit);
    } finally {
      if (detectHeatRateUnit() !== originalUnit) {
        try { await switchHeatRateUnit(originalUnit); } catch { /* đã lấy đủ dữ liệu cần thiết, bỏ qua lỗi khôi phục */ }
      }
    }
    const entries = [...(entriesByUnit["1"] || []), ...(entriesByUnit["2"] || [])];
    if (!entries.length) throw new Error("Không tìm thấy các chỉ tiêu suất hao nhiệt (công suất đầu cực, khói khô, chân không bình ngưng, nhiệt độ nước làm mát) trên màn hình này.");
    return { version: 1, operatingDate, sourcePage: location.href, kind: "heatrate", entries };
  }

  function extractPpaMeterPayload(operatingDate) {
    const extractors = globalThis.QlktMeterExtractor;
    if (!extractors) throw new Error("Bộ đọc công tơ PPA chưa được nạp. Hãy tải lại tiện ích.");

    // Cách 1 (ưu tiên): đọc thẳng dữ liệu đầy đủ mà QLKT nhúng sẵn trong các
    // thẻ <script> khởi tạo bảng tính (không phụ thuộc bảng đã cuộn tới đâu).
    let scriptError = null;
    if (typeof extractors.extractPpaMeterReadingsFromScripts === "function") {
      try {
        const scriptTexts = [...document.querySelectorAll("script")].map(script => script.textContent || "");
        return extractors.extractPpaMeterReadingsFromScripts(scriptTexts, operatingDate, location.href);
      } catch (error) {
        scriptError = error instanceof Error ? error.message : String(error);
      }
    }

    // Cách 2 (dự phòng): dò bảng HTML đang hiển thị trên trang.
    let tableError = null;
    if (typeof extractors.extractPpaMeterReadings === "function") {
      try {
        const tables = [...document.querySelectorAll("table")].map(table => [...table.rows].map(row => [...row.cells].map(cell => {
          const input = cell.querySelector("input:not([type='checkbox']):not([type='radio']):not([type='hidden'])");
          return input ? readValue(input) : cleanText(cell.textContent);
        })));
        return extractors.extractPpaMeterReadings(tables, operatingDate, location.href);
      } catch (error) {
        tableError = error instanceof Error ? error.message : String(error);
      }
    }

    // Cả hai cách đều thất bại: đính kèm URL/tiêu đề trang thực tế mà tab nền
    // này đang đứng, để biết nó có đúng là màn hình công tơ hay đã bị chuyển
    // sang trang khác (đăng nhập lại, chọn đơn vị, v.v.).
    const pageDiag = `[Trang hiện tại: "${document.title || ""}" — ${location.href}]`;
    throw new Error(`${scriptError || tableError || "Không đọc được dữ liệu bảng công tơ."} ${pageDiag}`);
  }

  function extract() {
    const operatingDate = parseDate();
    if (!operatingDate) throw new Error("Không xác định được ngày báo cáo trên trang QLKT.");
    const currentPageKind = pageKind();
    if (currentPageKind === "meter") return extractPpaMeterPayload(operatingDate);
    if (currentPageKind === "heatrate") return extractHeatRatePayload(operatingDate);
    const entries = new Map(), oilValues = [];
    const add = (fieldCode, candidate, sourceLabel) => {
      if (!candidate || candidate.value === null || entries.has(fieldCode)) return;
      entries.set(fieldCode, { fieldCode, value: candidate.value, sourceLabel });
    };
    const allTables = [...document.querySelectorAll("table")];
    allTables.forEach(table => {
      const tableText = normalized(table.textContent);
      const candidates = inputsWithContext(table);
      const find = (headerParts, rowPart) => candidates.find(item => headerParts.every(part => item.header.includes(part)) && (!rowPart || item.row.includes(rowPart)));

      if (tableText.includes("sl diem ban") && tableText.includes("dien nang dau cuc")) {
        add("B", find(["dien nang dau cuc", "sl phat"], "mf1"), "QLKT · DH1_MF1 · SL phát");
        add("C", find(["sl diem ban"], "mf1"), "QLKT · DH1_MF1 · SL điểm bán");
        add("H", find(["dien nang dau cuc", "sl phat"], "mf2"), "QLKT · DH1_MF2 · SL phát");
        add("I", find(["sl diem ban"], "mf2"), "QLKT · DH1_MF2 · SL điểm bán");
      }

      if (tableText.includes("nhien lieu than")) {
        add("AJ", find(["nhiet tri cao lam viec"], null), "QLKT · Nhiệt trị cao làm việc HHV");
        add("AE", find(["to may dh1_mf1", "tong"], null), "QLKT · Than DH1_MF1 · Tổng");
        add("AF", find(["to may dh1_mf2", "tong"], null), "QLKT · Than DH1_MF2 · Tổng");
        add("AR", find(["ton (tan)"], null), "QLKT · Than tồn kho");
        add("AT", find(["kl than nhap"], null), "QLKT · Khối lượng than nhập");
      }

      if (tableText.includes("nhien lieu dau fo") && tableText.includes("nuoc tieu thu")) {
        const oilS1 = find(["nhien lieu dau fo", "tong"], "mf1"), oilS2 = find(["nhien lieu dau fo", "tong"], "mf2");
        if (oilS1?.value !== null && oilS1?.value !== undefined) oilValues.push(Number(oilS1.value));
        if (oilS2?.value !== null && oilS2?.value !== undefined) oilValues.push(Number(oilS2.value));
        add("CC", find(["nuoc tieu thu"], "mf1"), "QLKT · DH1_MF1 · Nước tiêu thụ");
        add("CD", find(["nuoc tieu thu"], "mf2"), "QLKT · DH1_MF2 · Nước tiêu thụ");
      }

      if (tableText.includes("so gio phat")) {
        const hours = candidates.filter(item => item.header.includes("so gio phat") && item.value !== null);
        add("F", hours.find(item => item.row.includes("mf1")) || hours[0], "QLKT · Tổ máy S1 · Số giờ phát");
        add("L", hours.find(item => item.row.includes("mf2")) || hours[1], "QLKT · Tổ máy S2 · Số giờ phát");
      }
    });
    if (currentPageKind === "production") {
      const rowInputs = unit => {
        const rows = [...document.querySelectorAll("tr")].filter(row => normalized(row.textContent).includes(unit));
        const ranked = rows.map(row => [...row.querySelectorAll("input")]
          .map(input => ({ value: parseNumber(readValue(input)), input }))
          .filter(candidate => candidate.value !== null))
          .sort((left, right) => right.length - left.length);
        return ranked[0] || [];
      };
      const s1 = rowInputs("dh1_mf1"), s2 = rowInputs("dh1_mf2");
      if (!entries.has("B")) add("B", s1[0], "QLKT · DH1_MF1 · SL phát");
      if (!entries.has("C")) add("C", s1[2], "QLKT · DH1_MF1 · SL điểm bán");
      if (!entries.has("H")) add("H", s2[0], "QLKT · DH1_MF2 · SL phát");
      if (!entries.has("I")) add("I", s2[2], "QLKT · DH1_MF2 · SL điểm bán");
    }
    if (currentPageKind === "fuel" && ["AJ", "AE", "AF", "AR", "AT"].some(code => !entries.has(code))) {
      const coalRows = [...document.querySelectorAll("tr")]
        .filter(row => !row.querySelector("tr"))
        .map(row => [...row.querySelectorAll("input")]
        .map(input => ({ value: parseNumber(readValue(input)), input }))
        .filter(candidate => candidate.value !== null))
        .filter(row => row.length >= 15)
        .sort((left, right) => Math.abs(left.length - 15) - Math.abs(right.length - 15));
      const coal = coalRows[0] || [];
      if (!entries.has("AJ")) add("AJ", coal[0], "QLKT · Nhiệt trị cao làm việc HHV");
      if (!entries.has("AE")) add("AE", coal[4], "QLKT · Than DH1_MF1 · Tổng");
      if (!entries.has("AF")) add("AF", coal[8], "QLKT · Than DH1_MF2 · Tổng");
      if (!entries.has("AR")) add("AR", coal[13], "QLKT · Than tồn kho");
      if (!entries.has("AT")) add("AT", coal[14], "QLKT · Khối lượng than nhập");
    }
    if (currentPageKind === "operation" && (!entries.has("F") || !entries.has("L"))) {
      const hourHeader = [...document.querySelectorAll("th, td")].find(cell => {
        const label = normalized(cell.textContent);
        return !cell.querySelector("input") && label.includes("so gio phat") && label.length < 40;
      });
      const headerRect = hourHeader?.getBoundingClientRect();
      const hourFromRow = unit => {
        const row = [...document.querySelectorAll("tr")].find(candidate => normalized(candidate.textContent).includes(unit));
        if (!row) return null;
        const candidates = [...row.querySelectorAll("input")]
          .map(input => ({ input, value: parseNumber(readValue(input)), rect: input.getBoundingClientRect() }))
          .filter(candidate => candidate.value !== null && candidate.rect.width > 0 && candidate.rect.height > 0);
        if (!candidates.length) return null;
        if (headerRect?.width) {
          const headerCenter = headerRect.left + headerRect.width / 2;
          return candidates.sort((left, right) => {
            const leftDistance = Math.abs(left.rect.left + left.rect.width / 2 - headerCenter);
            const rightDistance = Math.abs(right.rect.left + right.rect.width / 2 - headerCenter);
            return leftDistance - rightDistance;
          })[0];
        }
        return candidates[1] || candidates[0];
      };
      if (!entries.has("F")) add("F", hourFromRow("dh1_mf1"), "QLKT · Tổ máy S1 · Số giờ phát");
      if (!entries.has("L")) add("L", hourFromRow("dh1_mf2"), "QLKT · Tổ máy S2 · Số giờ phát");
    }
    // QLKT reports electrical production in MWh, while the KTKT table stores
    // these four daily values in million kWh (1 million kWh = 1,000 MWh).
    for (const fieldCode of ["B", "C", "H", "I"]) {
      const entry = entries.get(fieldCode);
      if (!entry) continue;
      const sourceMwh = Number(entry.value);
      if (!Number.isFinite(sourceMwh)) continue;
      entries.set(fieldCode, {
        ...entry,
        value: String(sourceMwh / 1000),
        sourceLabel: `${entry.sourceLabel} · MWh → triệu kWh`,
      });
    }

    if (oilValues.length === 2) entries.set("X", { fieldCode: "X", value: String(oilValues[0] + oilValues[1]), sourceLabel: "QLKT · Tổng dầu FO S1 + S2" });
    if (!entries.size) throw new Error("Màn hình này chưa có chỉ tiêu nào trong danh sách đồng bộ.");
    return { version: 1, operatingDate, sourcePage: location.href, entries: [...entries.values()] };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_QLKT_PAGE_KIND") {
      const kind = pageKind();
      if (kind) rememberPage();
      sendResponse({ ok: Boolean(kind), pageKind: kind });
      return;
    }
    if (message?.type === "PREPARE_QLKT_DATE") {
      try { sendResponse({ ok: true, ...prepareDate(message.operatingDate) }); }
      catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Không đặt được ngày QLKT." }); }
      return;
    }
    if (message?.type !== "READ_QLKT_VALUES") return;
    // extract() đồng bộ với hầu hết màn hình, nhưng bất đồng bộ (Promise) với màn hình Cân bằng
    // nhiệt (phải chuyển dropdown Tổ máy và chờ AJAX) — bọc trong Promise.resolve().then() để xử lý
    // đúng cả 2 trường hợp mà không cần biết trước extract() trả về gì.
    Promise.resolve()
      .then(() => extract())
      .then(payload => sendResponse({ ok: true, payload, pageKind: pageKind() }))
      .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Không đọc được dữ liệu QLKT." }));
    return true;
  });

  rememberPage();
  const recognitionObserver = new MutationObserver(() => {
    if (!pageKind()) return;
    rememberPage();
    recognitionObserver.disconnect();
  });
  recognitionObserver.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => recognitionObserver.disconnect(), 15000);
})();
