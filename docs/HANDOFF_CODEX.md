# Bàn giao cho Codex — 15/09/2026 (từ Claude)

Đọc file này trước khi làm bất cứ gì tiếp trên tính năng "Đồng bộ QLKT" /
trang `/ppa-heat-rate`. Đây là tóm tắt chính xác những gì Claude vừa làm
trong phiên vừa rồi, để Codex không mất công dò lại từ đầu.

## ⚠️ Việc đầu tiên cần làm: kiểm tra git status

**Toàn bộ các thay đổi mô tả dưới đây CHƯA được `git commit`.** Commit gần
nhất trước đó là `422add5` ("Add QLKT sync extension and one-click sync
wiring", do Codex làm). Mọi thứ từ mục "Những gì đã sửa" trở xuống là code
đã ghi thẳng vào ổ đĩa nhưng còn nằm ở working tree, chưa commit. Chạy
`git status` / `git diff` trước để thấy đầy đủ, rồi commit lại (Claude
không có quyền truy cập terminal máy người dùng trong phiên vừa rồi nên
không tự commit được).

## Bối cảnh: vấn đề là gì

Người dùng báo nút "Đồng bộ QLKT" trên trang so sánh PPA
(`components/ppa-heat-rate-comparison.tsx`) không lấy được dữ liệu công tơ
thật từ QLKT, dù code (do Codex viết trước đó) đã có vẻ hoàn chỉnh và 21
test tự động đều pass. Test pass vì test dùng dữ liệu HTML bảng giả lập
(`<table>` đầy đủ H1–H48 trong 1 hàng header) — không mô phỏng đúng cấu
trúc DOM thật của QLKT.

## Nguyên nhân gốc (đã xác nhận trên trang QLKT thật)

Claude đã trực tiếp đăng nhập vào QLKT thật (`qlkt.tpcduyenhai.com.vn`,
trang `sxd/solieucto.jsf` = "Số liệu đo đếm công tơ") để debug, và phát
hiện **2 lớp vấn đề khác nhau**, cả hai đều đã sửa:

### 1. Bảng công tơ trên QLKT bị ảo hoá (virtualized) cả hàng lẫn cột

`meter-extract.js` bản cũ của Codex tìm một `<table>` có hàng header chứa
đủ cả 48 cột "H1"..."H48" cùng lúc rồi mới đọc dữ liệu bên dưới. Nhưng
trang QLKT thật **không bao giờ** render đủ 48 cột cùng lúc trong DOM — nó
dùng widget bảng tính "ExtSheet" (PrimeFaces Extensions) chỉ vẽ ra một
phần nhỏ số cột/dòng đang nhìn thấy được để tăng tốc. Vì vậy cách đọc DOM
luôn báo "Không tìm thấy bảng Số liệu đo đếm công tơ có đủ H1–H48."

**Phát hiện quan trọng:** toàn bộ dữ liệu (kể cả DHA_S1, DHA_S2, DH1_285M,
DH1_283M với đủ 48 chu kỳ) thực ra luôn nằm sẵn, đầy đủ, dạng mảng JSON,
ngay trong mã nguồn trang — bên trong một thẻ `<script>` gọi
`PrimeFaces.cw("ExtSheet", "sheetWidget", {..., data: [[...]]}, ...)`.
Đây là cấu hình khởi tạo widget, không phụ thuộc việc bảng đã cuộn/hiển
thị tới đâu.

Cấu trúc mỗi hàng dữ liệu (mảng con trong `data`): 53 phần tử =
`[tên điểm đo, kênh, ngày, nguồn dữ liệu, tổng, H1, H2, ..., H48]`. Mỗi
điểm đo có 4 hàng (kênh `kWhGiao`, `kWhNhan`, `kVarhGiao`, `kVarhNhan`) —
chỉ cần lấy hàng có kênh `kWhGiao`. Tên điểm đo trong dữ liệu thật có thể
có khoảng trắng đệm ở cuối (ví dụ `"DHA_S1                    "`).

**Đã sửa:** thêm hàm mới `extractPpaMeterReadingsFromScripts()` trong
`meter-extract.js` — quét tất cả thẻ `<script>` trên trang, tìm đoạn
`data:[...]` sau chữ "ExtSheet" bằng cách đếm ngoặc vuông cân bằng (có xử
lý chuỗi/escape), parse bằng `JSON.parse` (dữ liệu thật là JSON hợp lệ,
không cần `eval`), rồi lọc theo tên điểm đo + kênh `kWhGiao` + ngày. Hàm
đọc bảng DOM cũ (`extractPpaMeterReadings`) vẫn được giữ lại làm phương án
dự phòng, gọi sau nếu cách mới thất bại. `content.js`'s
`extractPpaMeterPayload()` đã được sửa để thử cách mới trước, dự phòng
cách cũ sau.

### 2. QLKT không dựng bảng ExtSheet nếu tab chạy nền (active: false)

Sau khi sửa xong lỗi #1, đồng bộ vẫn báo lỗi "Không tìm thấy dữ liệu bảng
công tơ (ExtSheet) trong mã nguồn trang." Debug thêm bằng cách thêm log
chẩn đoán vào thông báo lỗi (số thẻ script đã quét, có "ExtSheet" hay
không, URL/tiêu đề trang thật) thì phát hiện: tab nền mà `background.js`
tự mở (`chrome.tabs.create({url, active:false})`) tải ĐÚNG trang (đúng URL,
đúng tiêu đề "QLKT - Đọc xem số liệu đo đếm") nhưng chỉ có ~21 thẻ
`<script>` thay vì ~70 thẻ như khi xem trực tiếp — nghĩa là QLKT có vẻ trì
hoãn/không bao giờ dựng bảng dữ liệu nặng này nếu tab không ở trạng thái
đang hiển thị (`document.hidden === true`).

**Đã sửa:** trong `readSource()` (`background.js`), riêng nguồn `"meter"`
giờ mở tab ở chế độ **đang xem** (`active: true`) thay vì chạy nền, rồi
sau khi lấy xong dữ liệu (đóng tab tạm) sẽ tự động `chrome.tabs.update`
quay lại đúng tab người dùng đang làm việc trước đó. Các nguồn khác (sản
lượng/nhiên liệu/vận hành, dùng cho nút đồng bộ trên bảng tháng) vẫn mở
nền như cũ — không có dấu hiệu bị lỗi tương tự.

### Các sửa nhỏ khác đi kèm

- `background.js`: tăng số lần thử đọc lại và thời gian chờ riêng cho
  nguồn `"meter"` (tối đa ~40 lần / khoảng 700ms mỗi lần ≈ tới 28s, cộng
  chờ ban đầu 1.5–4s) vì màn hình công tơ nặng hơn hẳn các màn hình khác.
- `background.js`: `syncPpa()` giờ **luôn** mở thẳng địa chỉ cố định
  `http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/solieucto.jsf`
  (hằng số `DEFAULT_METER_URL`), không dùng địa chỉ "đã ghi nhớ"
  (`chrome.storage.local.qlktPages.meter`) nữa — địa chỉ ghi nhớ trước đó
  có thể sai/lệch (không rõ do đâu, nhưng loại bỏ luôn cho chắc, theo yêu
  cầu người dùng).
- `meter-extract.js` + `content.js`: thông báo lỗi khi không tìm thấy dữ
  liệu giờ có kèm chi tiết chẩn đoán (số thẻ script đã quét, có bao nhiêu
  thẻ chứa "ExtSheet"/"data:[", URL+tiêu đề trang thật lúc đọc) — hữu ích
  nếu vẫn còn lỗi khác phát sinh sau này, không cần debug lại từ đầu.
- Phiên bản tiện ích (`manifest.json`) đã tăng dần 0.3.1 → **0.4.3** qua
  các lần sửa trên. Chuỗi hiển thị "phiên bản 0.3.1" trong 2 file
  `components/daily-production-table.tsx` và
  `components/ppa-heat-rate-comparison.tsx` cũng đã cập nhật theo.
- Thêm 2 test mới vào `tests/qlkt-meter-sync.test.mjs` mô phỏng đúng cấu
  trúc `data:[...]` thật (kể cả tên điểm đo có khoảng trắng đệm, 4 kênh mỗi
  điểm đo) cho `extractPpaMeterReadingsFromScripts`. Tổng cộng 23/23 test
  tự động đang pass (`node --test tests/*.mjs`).

## Danh sách file đã sửa trong phiên này

Có 2 bản song song luôn phải sửa cùng nhau (nội dung phải giống hệt nhau):
- `public/qlkt-sync-extension/` (bản được `public/` phục vụ, tải qua
  `/qlkt-sync-extension.zip`)
- `browser-extension/qlkt-sync/` (bản mã nguồn gốc — **đây là bản người
  dùng thực sự đang "Load unpacked" vào Chrome**, theo xác nhận từ
  `chrome://extensions` > Chi tiết > "Loaded from")

Trong mỗi thư mục trên:
- `meter-extract.js` — thêm `extractPpaMeterReadingsFromScripts` + hàm phụ
  `extractDataArraysFromScripts`.
- `content.js` — `extractPpaMeterPayload()` gọi cách mới trước, cách cũ dự
  phòng, thêm chẩn đoán vào lỗi cuối.
- `background.js` — thêm `DEFAULT_METER_URL`, sửa `readSource()` (tab
  active cho nguồn meter + khôi phục tab cũ, tăng retry budget),
  `syncPpa()` dùng URL cố định.
- `manifest.json` — version → 0.4.3.

Ngoài ra:
- `tests/qlkt-meter-sync.test.mjs` — thêm 2 test mới.
- `components/daily-production-table.tsx`,
  `components/ppa-heat-rate-comparison.tsx` — chuỗi text "phiên bản 0.3.1"
  → "phiên bản 0.4.1" (chỉ là text gợi ý hiển thị khi tiện ích chưa kết
  nối, không ảnh hưởng logic).
- `docs/ACCEPTANCE.md` — đã có mục bổ sung ngày 15/09/2026 mô tả tính năng
  PPA + đồng bộ QLKT (viết TRƯỚC khi phát hiện 2 lỗi ở trên — nội dung đó
  hơi lạc hậu so với thực tế đã sửa, nên cân nhắc cập nhật lại hoặc thêm
  mục mới nói rõ 2 nguyên nhân/khắc phục ở trên).

## Trạng thái hiện tại — CHƯA XÁC NHẬN CUỐI CÙNG

Người dùng đang thử lại bản 0.4.3 (bản có sửa "mở tab đang xem thay vì
chạy nền" — đây là lần sửa mới nhất và có khả năng cao là bản sửa đúng,
dựa trên bằng chứng thu thập được, nhưng **chưa nhận được xác nhận từ
người dùng là đã thành công hay chưa** tại thời điểm bàn giao này).

Việc đầu tiên Codex nên làm: hỏi người dùng đã thử lại bản 0.4.3 chưa và
kết quả ra sao. Nếu vẫn lỗi, thông báo lỗi hiển thị trên web (đã có chẩn
đoán chi tiết) sẽ cho biết chính xác vướng ở đâu — không cần đoán lại từ
đầu.

## Ghi chú kỹ thuật khác cần biết

- Sandbox chạy lệnh trên máy người dùng (`device_bash` phía Claude) bị lỗi
  "Workspace unavailable" xuyên suốt phiên do một bản cập nhật Windows
  ngày 8/9 — Claude phải copy file qua lại bằng cơ chế stage/commit file
  riêng (không phải lỗi của Codex, không liên quan tới Codex).
- `wrangler d1 migrations apply --local` có lỗi "table
  `ppa_heat_rate_daily` already exists" do bảng ghi (`d1_migrations`) bị
  lệch với trạng thái SQLite cục bộ thật — CHƯA xử lý, không chặn việc
  chạy dev, người dùng đã chủ động bỏ qua để tiếp tục việc khác trước đó.
