# Bổ sung Apps Script để nhập đánh giá lịch sử

Mục đích: nhập **một lần** nội dung hai cột “Đánh giá suất hao nhiệt, nguyên nhân tăng/giảm” của S1 và S2 từ trang `DH1` về web Chỉ tiêu. Sau lần nhập này, web là nguồn chính và tiếp tục đẩy dữ liệu lên Google Sheet.

## 1. Bổ sung nhánh đọc trong `doPost(e)` hiện có

Đặt đoạn sau **sau bước kiểm tra mã kết nối** và trước nhánh ghi dữ liệu:

```javascript
if (body.action === "readAssessments") {
  return jsonOutput_({ ok: true, rows: readHistoricalAssessments_() });
}
```

Trong đó `body` là JSON đã đọc từ `e.postData.contents`. Nếu hàm trả JSON hiện tại có tên khác `jsonOutput_`, thay bằng đúng tên hàm đang dùng.

## 2. Thêm các hàm dưới đây vào cuối tệp Apps Script

```javascript
function normalizeHeader_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function sheetDateIso_(value, displayValue) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  }
  var match = String(displayValue || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (!match) return "";
  return match[3] + "-" + ("0" + match[2]).slice(-2) + "-" + ("0" + match[1]).slice(-2);
}

function readHistoricalAssessments_() {
  var spreadsheet = SpreadsheetApp.openById("1L0NtMse98j0QBR2kjcK4E1Iob2XLDdrfNM99pBDBcyo");
  var sheet = spreadsheet.getSheetByName("DH1");
  if (!sheet) throw new Error('Không tìm thấy trang "DH1".');

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];
  var range = sheet.getRange(1, 1, lastRow, lastColumn);
  var values = range.getValues();
  var displays = range.getDisplayValues();

  var dateColumn = -1;
  var assessmentColumns = [];
  var headerRows = Math.min(20, lastRow);
  for (var row = 0; row < headerRows; row++) {
    for (var column = 0; column < lastColumn; column++) {
      var header = normalizeHeader_(displays[row][column]);
      if (dateColumn < 0 && header === "ngay") dateColumn = column;
      if (header.indexOf("danh gia suat hao nhiet") >= 0 && assessmentColumns.indexOf(column) < 0) {
        assessmentColumns.push(column);
      }
    }
  }
  if (dateColumn < 0) throw new Error('Không tìm thấy cột "Ngày".');
  if (assessmentColumns.length < 2) throw new Error('Không tìm thấy đủ hai cột "Đánh giá suất hao nhiệt" của S1 và S2.');
  assessmentColumns.sort(function (a, b) { return a - b; });

  var rows = [];
  for (var index = 0; index < lastRow; index++) {
    var iso = sheetDateIso_(values[index][dateColumn], displays[index][dateColumn]);
    if (!iso) continue;
    var noteS1 = String(displays[index][assessmentColumns[0]] || "").trim();
    var noteS2 = String(displays[index][assessmentColumns[1]] || "").trim();
    if (!noteS1 && !noteS2) continue;
    rows.push({ row: index + 1, iso: iso, noteS1: noteS1, noteS2: noteS2 });
  }
  return rows.slice(0, 500);
}
```

## 3. Triển khai lại

Trong Apps Script chọn **Deploy → Manage deployments → Edit → New version → Deploy**. Giữ nguyên URL `/exec` và mã kết nối đã cấu hình trên web.

Sau đó mở tab **So sánh trực quan**, bấm **Nhập đánh giá cũ**, kiểm tra danh sách xem trước và xác nhận. Web chỉ cập nhật S1/S2 cho những ngày đã có kết quả PPA; ngày chưa có PPA được báo là bỏ qua.
