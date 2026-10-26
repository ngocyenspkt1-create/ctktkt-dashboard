# Luồng đọc, ghi và phân quyền dữ liệu

Cập nhật 26/10/2026. Tài liệu cho người bảo trì và AI tiếp tục sửa dự án.

## Điểm nghẽn và thay đổi

| Thao tác | Trước | Sau |
| --- | --- | --- |
| Mở CTKTKT ngày | Đợi cả tháng và lũy kế năm | Ngày đang chọn và D-1 trước; sau đó ngữ cảnh tồn kho và giờ năm |
| Kiểm tra sau lưu | Đọc cả tháng, dữ liệu liên kết và tính giờ năm | `scope=stored&date=...`: một truy vấn đúng ngày, chỉ số nhập đã lưu |
| Xem PMIS/PPA nhiều tháng | Gửi đồng thời mọi tháng; PMIS và cửa sổ PPA còn tính giờ năm không dùng | Một tháng mỗi đợt; 2–3 yêu cầu độc lập trong tháng; bỏ giờ năm |
| Khoảng ngày lẻ | Tải trọn tháng đầu/cuối | `from/to` giới hạn phần giao của tháng; CTKTKT giữ D-1 phục vụ chênh lệch |
| Dữ liệu ngày trong PMIS/PPA | Nhận cả `KTKT:*`, rồi nhận lại từ API CTKTKT | `scope=non-ktkt` bỏ bản sao ở API daily-inputs |
| Đổi ngày/khoảng liên tục | Một số lượt cũ vẫn tải và có thể thay kết quả mới | AbortController hủy lượt cũ; kiểm tra hủy sau đọc phản hồi |
| Mở CTKTKT | Tải sẵn mã cửa sổ ảnh/mail | Chỉ tải các cửa sổ này khi mở; cửa sổ ảnh giữ trạng thái sau lần mở đầu |
| BCSX | Bốn lượt đọc tuần tự | Hai nhóm, mỗi nhóm tối đa hai yêu cầu; đổi ngày hủy lượt cũ |
| Bảng PMIS/PPA khoảng dài | Dựng mọi ngày cùng lúc trong DOM | Mỗi trang tối đa 30 ngày; chuyển trang thay phần hiển thị, biểu đồ/Excel giữ đủ khoảng |

## CTKTKT theo từng đợt

1. `GET /api/ctktkt-report?period=YYYY-MM&date=YYYY-MM-DD&scope=daily-links`: tải ngày và D-1 bằng bốn truy vấn, chưa tính lũy kế năm. Các ô ngày được nhập ngay sau bước này.
2. Nếu cần, tải `from=ngày-01&to=D-1&scope=daily-links` để giữ đúng chuỗi tồn kho và quy tắc chuyển số đầu kỳ. Khi gộp, chỉ bổ sung ngày trước D-1; không thay dữ liệu D hoặc D-1 đã tải, không đè ô người dùng vừa nhập.
3. `scope=operating-hours&date=...`: tải riêng lũy kế QLKT. Chưa đủ các đợt thì hiện trạng thái và chặn xuất Excel/mail. Lỗi giữ số đang nhập; muốn tải lại phải lưu trước.

Không bỏ ngữ cảnh đầu tháng để tối ưu một cách máy móc: W86 và tồn kho PMIS cần chuỗi tiêu thụ từ ngày 01. Xuất Excel tiếp tục dùng đường đọc đầy đủ hiện có.

## Ghi dữ liệu

- Gửi ô thực sự thay đổi, không gửi lại cả bảng/tháng. Máy chủ kiểm toàn bộ danh sách trước khi ghi, chặn ô trùng, ngày không tồn tại, ô không được phép và tổ máy than lẫn nhau.
- `auditedDailyBatch` giữ giao dịch dữ liệu và nhật ký. Sau POST, đọc lại đúng ngày bằng `scope=stored`, so khớp từng ô trước khi báo thành công. Nếu đọc lại thất bại/khác số, giữ dữ liệu và ảnh để kiểm tra.
- Chưa áp dụng tự động lưu từng phím gõ hoặc cơ chế ghi nền không xác nhận. Không thay khóa ngày, quy tắc D/D-1 hay số liệu vận hành khi thử.
- `getRawDb` có bộ đệm truy vấn theo revision lưu trong DB; giao dịch ghi tăng revision cùng dữ liệu. Không thêm cache phiên đăng nhập/phân quyền hoặc cache trình duyệt dùng chung. GET mới vẫn `Cache-Control: no-store`.

## Phân quyền đã rà soát

- GET số liệu vận hành tiếp tục yêu cầu tài khoản đang hoạt động đăng nhập. Chính sách hiện tại cho tài khoản hợp lệ xem báo cáo chung; đợt này không đổi chính sách xem thành cô lập theo tổ/nhóm. `view_all` không phải bộ lọc từng ô của các GET này.
- Phiên được xác minh bằng cookie và tải lại vai trò/quyền/cương vị hiện hành từ DB; tài khoản khóa, bắt buộc đổi mật khẩu hoặc thu hồi quyền không được giữ quyền ghi cũ nhờ cookie còn hạn. Không suy quyền từ tên chức danh khi danh sách quyền đã được lưu rõ ràng.
- Ghi CTKTKT dùng `canEditCtktktField` cho từng ô, D/D-1 cho người không phải admin; gửi một ô ngoài nhóm cũng từ chối cả lượt. Nhập than vẫn kiểm tổ ở cả phía client và API.
- Sửa nút/điều kiện đồng bộ PMIS ở CTKTKT: phải có nhóm `pmis_reports`, không được dùng quyền nhập bất kỳ nhóm khác để bật đồng bộ. Máy chủ vẫn kiểm từng ô như trước.
- Quyền nhập dữ liệu ngày, PMIS, PPA, nước, hóa chất và quản trị tiếp tục tách theo các module/grant hiện có; bộ kiểm thử thu hồi quyền và giới hạn nhóm vẫn phải chạy khi sửa.

## Kiểm chứng và giới hạn

- Test SQLite giả lập xác nhận: bước đầu CTKTKT bốn truy vấn đúng D/D-1; readback một truy vấn đúng D, không join/tính năm; số ngày sau ghép các đợt bằng đường đọc đầy đủ; phạm vi ngày lẻ và dữ liệu liên kết giữ nguyên.
- Test request trực tiếp xác nhận thu hồi quyền và ô ngoài nhóm bị từ chối trước ghi; kiểm tra khoảng không hợp lệ trước truy vấn. Test tải tháng xác nhận chỉ một tháng hoạt động và lượt hủy không trả kết quả cũ.
- Test toàn dự án và build Webpack/TypeScript phải đạt trước triển khai. Thay kiểm tra nguồn cũ giả định URL luôn bắt đầu `?period=` bằng kiểm tra bộ tạo query giới hạn mới.
- Số truy vấn là đo trong fixture xác định; không phải số đo tốc độ Internet hoặc FPS trên máy người dùng. Khoảng nhiều năm vẫn cần nhiều thời gian tổng thể, nhưng không bắn tất cả yêu cầu cùng lúc. Bảng phân trang 30 ngày, chưa thêm virtualization và chưa đổi schema dữ liệu.
