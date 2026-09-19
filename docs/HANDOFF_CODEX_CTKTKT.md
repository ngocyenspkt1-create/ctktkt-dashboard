# Bàn giao chức năng Chỉ tiêu KTKT từ workbook ngày 17/09/2026

**Nguồn phân tích:** `CHỈ TIÊU KINH TẾ KỸ THUẬT 17.09.2026.xls` (chỉ đọc)

**Trang web:** `/ctktkt-report`

**Ngày thực hiện:** 19/09/2026

## 1. Những gì đã xác minh từ file gốc

- Workbook có 35 sheet: `d-1`, 31 sheet ngày `01`–`31`, `Tổng hợp tháng`, `Sheet1`, `Sheet2`.
- Các sheet ngày có cùng khuôn `A1:AV210`, khoảng 900 công thức/sheet; sheet tổng hợp tháng có 475 công thức.
- Toàn workbook có 29.394 công thức. Các hàm được dùng chỉ gồm `SUM`, `IF`, `AND`, `MAX`, `MIN`, `SUMPRODUCT`, `AVERAGE`; phần còn lại là phép toán và tham chiếu ô/sheet.
- Đã đối chiếu 31 sheet để nhận diện 332 ô nhập tay có giá trị thay đổi theo ngày. Các ô công thức không được cho sửa trên giao diện.
- Công thức KPI chính đã được tách thành logic web dùng toàn bộ độ chính xác, không làm tròn giữa chừng:
  - Sản lượng ngày = chỉ số công tơ 24h ngày D − chỉ số 24h ngày D−1.
  - Than theo ca = tổng 12 cân tại mốc sau − tổng 12 cân tại mốc trước.
  - Than quy ẩm 8,5% = `m × (1 − W/100) / (1 − 8,5%)`.
  - Suất hao than tinh = `than quy ẩm × 1000 / điện giao (MWh)`.
  - Suất hao nhiệt tinh = `suất hao than tinh × HHV (kJ/kg) / 1000`.
  - Tỷ lệ điện tự dùng gồm tổn thất MBA = `(điện đầu cực − điện giao) / điện đầu cực × 100`.

## 2. Chức năng đã làm

- Thêm mục điều hướng **Báo cáo Chỉ tiêu KTKT**.
- Chọn ngày vận hành; tải cả ngày D và D−1 để tính chênh lệch công tơ.
- 332 ô nhập tay được gom thành 7 nhóm, có tìm kiếm theo tên hoặc mã ô Excel.
- Kết quả S1, S2 và toàn nhà máy tự tính, nền xanh và không cho sửa.
- Dữ liệu lưu vào bảng `daily_inputs` hiện có bằng mã `KTKT:<ô>`; không cần migration mới.
- Khi đã có dữ liệu ở trang “Dữ liệu các tháng”, API xuất tự dùng các trường B/C/H/I/AE/AF/AJ/CJ/AR làm giá trị dự phòng cho vùng PMIS tương ứng.
- Xuất workbook `.xlsx` theo mẫu gốc; Excel được yêu cầu tính lại toàn bộ công thức khi mở.

## 3. Bảo toàn file xuất

Bộ kiểm thử `tests/ctktkt-export.test.mjs` đã xác nhận qua vòng mở mẫu → ghi dữ liệu → xuất → mở lại:

- Đủ và đúng thứ tự 35 sheet.
- Toàn bộ công thức giữ nguyên.
- Toàn bộ merge giữ nguyên.
- Kích thước hàng/cột giữ nguyên.
- Style của mọi ô giữ nguyên.
- Thiết lập in, lề, hướng giấy và header/footer giữ nguyên.
- Cờ `fullCalcOnLoad=1` có trong `xl/workbook.xml`.
- Mẫu nhúng đã xóa toàn bộ số liệu vận hành và kết quả công thức lưu đệm trước khi đưa vào mã nguồn. 252 comment dạng VML của file nguồn cũng được bỏ khỏi mẫu phát hành vì có thể chứa ghi chú vận hành thực và liên kết VML không được ExcelJS ghi lại an toàn.

Đây là mức “giống file gốc nhất” có thể kiểm chứng bằng cấu trúc. File xuất dùng `.xlsx` vì định dạng `.xls` cũ không thể được ExcelJS ghi lại an toàn trên Vercel.

## 4. Lỗi có sẵn trong file nguồn

- Có 463 công thức chứa `#REF!` hoặc liên kết ngoài kiểu `'[2]16'!...`.
- Ví dụ: `J6`, `J32:J34` và vùng chỉ tiêu tro xỉ/phân tích than `P:X` hàng 169–173.
- Nhiều công thức ca cuối tham chiếu sang sheet ngày sau, nên tại ngày cuối có thể cho số âm rất lớn khi sheet sau chưa nhập.
- Web không dùng các lỗi này để tính KPI chính. File xuất vẫn giữ nguyên để truy vết; chưa tự ý thay vì chưa có nguồn xác nhận cho các tham chiếu bị mất.

## 5. Kiểm tra kỹ thuật

- `npx.cmd tsc --noEmit`: đạt.
- `node --test tests/*.mjs`: 52/52 đạt trước khi bổ sung kiểm thử cấu trúc; kiểm thử cấu trúc riêng đạt.
- `npm.cmd run build`: đạt, có route `/ctktkt-report`, `/api/ctktkt-report`, `/api/ctktkt-report/export`.
- Các file mới/sửa của chức năng này chạy ESLint riêng: đạt.
- Lint toàn dự án vẫn không đạt do 10 lỗi nền React Hooks ở các component cũ; chức năng mới không thêm lỗi lint.

## 6. Việc còn phải nghiệm thu trước khi dùng chính thức

1. Đăng nhập trên localhost/Vercel và nhập thử trọn hai ngày liên tiếp để kiểm tra phép trừ công tơ.
2. Xuất tháng thử, mở bằng Microsoft Excel và bấm tính lại nếu Excel chưa tự tính.
3. Đối chiếu ít nhất một ngày với báo cáo đã ký: điện đầu cực, điện giao, than 3 ca, độ ẩm, nhiệt trị, suất hao than và suất hao nhiệt.
4. Xác nhận nguồn đúng thay cho 463 tham chiếu bị hỏng trước khi sửa vùng tro xỉ/phân tích than.
5. Chỉ chốt dùng thật sau khi có biên bản so sánh web–Excel–PMIS/QLKT và sai lệch bằng 0 tại độ chính xác nguồn.
