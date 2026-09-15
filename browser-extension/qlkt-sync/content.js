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
    const page = normalized(document.body?.innerText);
    if (page.includes("so lieu do dem cong to") && page.includes("nguon du lieu") && page.includes("kwhgiao")) return "meter";
    if (page.includes("dien nang dau cuc") && page.includes("sl diem ban")) return "production";
    if (page.includes("nhien lieu than") && page.includes("nhien lieu dau fo")) return "fuel";
    if (page.includes("so gio phat") && page.includes("luy ke so gio van hanh")) return "operation";
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

  function extractPpaMeterPayload(operatingDate) {
    const extractor = globalThis.QlktMeterExtractor?.extractPpaMeterReadings;
    if (!extractor) throw new Error("Bộ đọc công tơ PPA chưa được nạp. Hãy tải lại tiện ích.");
    const tables = [...document.querySelectorAll("table")].map(table => [...table.rows].map(row => [...row.cells].map(cell => {
      const input = cell.querySelector("input:not([type='checkbox']):not([type='radio']):not([type='hidden'])");
      return input ? readValue(input) : cleanText(cell.textContent);
    })));
    return extractor(tables, operatingDate, location.href);
  }

  function extract() {
    const operatingDate = parseDate();
    if (!operatingDate) throw new Error("Không xác định được ngày báo cáo trên trang QLKT.");
    const currentPageKind = pageKind();
    if (currentPageKind === "meter") return extractPpaMeterPayload(operatingDate);
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
    try { sendResponse({ ok: true, payload: extract(), pageKind: pageKind() }); }
    catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Không đọc được dữ liệu QLKT." }); }
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
