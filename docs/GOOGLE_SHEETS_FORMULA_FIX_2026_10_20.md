# Google Sheets — sửa cú pháp công thức, 20/10/2026

## Phạm vi đã xác nhận

Chỉ chuyển cú pháp từ Excel/English sang locale vi_VN: dấu phân cách đối số, dấu thập phân và phân cách cột mảng. Giữ nguyên toán tử, tham chiếu, hằng số, chuỗi trong dấu nháy và logic KPI. Người dùng chọn giữ nguyên tuyệt đối công thức mẫu gốc, không sửa tham chiếu hoặc bọc IFERROR để che lỗi có sẵn.

## Thực hiện

- Sửa 2446 ô công thức: bảng tháng 1048, CTKTKT 1280, nước 118. Chỉ ghi userEnteredValue vào đúng ô công thức. Không đổi locale, định dạng hoặc ô nhập liệu. Có bản sao công thức trước sửa tại .tmp/sheets-formula-repair-backup-2026-10-20.json; hai ô thử đầu là T10!E6 (=IFERROR(D6/B6/10, 0)) và 19!M29 (=M24-0.0011).
- Đã lưu bộ chuyển mới trong project Apps Script hiện hữu, giữ CONFIG, token, 9 ID, các hàm kiểm chứng và trigger. Không chạy install/tạo lại file. Hàm verifyMirror đối chiếu công thức sau chuyển cú pháp theo locale, không coi cú pháp Excel khác cú pháp Sheets là đổi logic.
- Đã chạy syncNow cập nhật 4 số liệu mới của ngày 20 (AA9, AK9, AL9, Q49) từ snapshot web. Không chỉnh số liệu nguồn.
- verifyMirror sau đồng bộ: READBACK_OK, 9 file, 156 trang, 435 vùng, 574270 ô, 0 chênh lệch; hash của 9 nguồn đều khớp. Phạm vi đối chiếu là các vùng đồng bộ, không phải chứng minh mọi công thức mẫu gốc đúng về kỹ thuật.
- Trước lần sync cuối, quét các vùng có nội dung của 9 file: không còn lỗi phân tích công thức ERROR sau sửa. Bảng tháng 2063 công thức, CTKTKT 29971, nước 472. Các ô nhập liệu của 3 file không đổi trong bước sửa cú pháp. Sáu file còn lại không có công thức/lỗi trong vùng đã đọc.
- Ví dụ Google tính lại: T10!E6 = 7.390580147502614; CTKTKT 19!M29 = 0.9895. Đã xem Google-rendered bảng tháng ở zoom 100%.

## Hạn chế công thức gốc được giữ theo yêu cầu

- CTKTKT còn 3110 ô DIVIDE_BY_ZERO trong lần quét sau sửa cú pháp (gồm ngày tương lai/chưa có dữ liệu, tổ máy dừng và lỗi lan truyền). Không gán 0 hoặc dấu gạch thay cho kết quả không xác định.
- Trang nền d-1 còn 3 lỗi VALUE: W59, AG59, AG60. Không sửa tham chiếu theo lựa chọn rõ ràng của người dùng. Chi tiết địa chỉ/công thức/thông báo được lưu tại .tmp/sheets-formula-repair-verification-2026-10-20.json.
- Không khẳng định mọi KPI Excel mẫu gốc đồng nhất với KPI web: lần này xác nhận dữ liệu đầu vào và công thức đúng bản xuất web sau chuyển cú pháp, không thay phương pháp tính.

## Kiểm thử nguồn

- 7 kiểm thử Google mirror tập trung đạt; toàn bộ 422 kiểm thử đạt; lint 2 file thay đổi đạt; vinext build đạt. Trạng thái release/deployment/storage cuối được bổ sung sau phát hành.
