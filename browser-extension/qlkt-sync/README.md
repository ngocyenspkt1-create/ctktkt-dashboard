# Tiện ích đồng bộ QLKT

Tiện ích đọc dữ liệu trên màn hình QLKT đang mở và chuyển sang web Chỉ tiêu KTKT bằng dữ liệu tạm trong phần `#` của địa chỉ. Web xóa phần dữ liệu tạm này ngay sau khi đọc và luôn yêu cầu người dùng kiểm tra trước khi lưu.

## Phạm vi phiên bản 0.4.4

- Sản lượng đầu cực, điểm bán và số giờ phát S1/S2.
- Nhiệt trị, than tiêu thụ S1/S2, than tồn kho và than nhập.
- Nước bổ sung S1/S2.
- Tổng dầu FO tiêu thụ của S1 và S2.
- Bốn điểm đo PPA (`DHA_S1`, `DH1_285M`, `DHA_S2`, `DH1_283M`) cùng đủ 48 chu kỳ nửa giờ.

Tiện ích không đọc trường mật khẩu, không lưu thông tin đăng nhập và không ghi dữ liệu ngược lên QLKT.

## Cài trên Chrome hoặc Edge

1. Giải nén tệp tiện ích.
2. Mở trang quản lý tiện ích của trình duyệt.
3. Bật chế độ dành cho nhà phát triển.
4. Chọn **Tải tiện ích đã giải nén** và chọn thư mục này.
5. Mở QLKT và đăng nhập.
6. Chỉ trong lần thiết lập đầu tiên, mở lần lượt ba màn hình **Sản lượng**, **Nhiên liệu** và **Tình hình vận hành**. Tiện ích tự ghi nhớ địa chỉ, không ghi nhớ tài khoản hoặc mật khẩu.
7. Từ những lần sau, ở bất kỳ màn hình QLKT nào, bấm biểu tượng tiện ích, chọn ngày và bấm **Đồng bộ tất cả**.

### Đồng bộ PPA bằng một nút trên web

1. Chỉ lần đầu, mở **Vận hành → Số liệu đo đếm công tơ**, chờ bảng hiện đủ dữ liệu rồi mở tiện ích để dòng **Công tơ PPA** báo **Đã ghi nhớ**.
2. Giữ tab công tơ QLKT này đang mở. Mở `http://localhost:5173/ppa-heat-rate` và nhấn F5. Trang phải báo **Tiện ích v0.4.4 đã kết nối**.
3. Hằng ngày chỉ cần chọn ngày và bấm **Đồng bộ QLKT** ngay trên web. Tiện ích tự mở màn hình công tơ ở thẻ nền, lấy dữ liệu rồi đóng thẻ.

Khi phiên QLKT hết hạn, đăng nhập QLKT lại rồi bấm đồng bộ. Dữ liệu luôn được đưa vào màn hình kiểm tra trước, chưa tự lưu vào kho dữ liệu.

Tiện ích tự mở ba màn hình ở các thẻ nền, đặt cùng ngày, thu thập dữ liệu, đóng các thẻ tạm và mở một bảng kiểm tra trên web Chỉ tiêu KTKT. Nút **Chỉ lấy trang đang mở** được giữ lại để dự phòng khi cần kiểm tra riêng một màn hình.
