# Đồng bộ 9 Google Sheets

Web là nguồn chính. Bản Google Sheets là bản xem theo tháng hiện tại, cập nhật mỗi giờ bằng tài khoản chủ sở hữu. Sửa trên Sheets không nhập ngược về web. Chỉ dữ liệu thay đổi mới ghi lại; không polling mỗi vài giây. Khi đổi tháng, Apps Script lưu bản sao riêng tư của từng file trước khi cập nhật tháng mới. Không thay đổi quyền chia sẻ.

## Cấp quyền một lần

1. Đăng nhập web bằng tài khoản quản trị. Mở `/api/google-mirror/setup` để tải `CTKTKT_Google_Sheets.gs`. File chứa mã kết nối riêng: không gửi vào chat, email hoặc GitHub.
2. Đăng nhập https://script.google.com bằng **yen.nn.cbsxdh1@gmail.com**, chọn **New project / Dự án mới**, đặt tên `CTKTKT – Đồng bộ 9 Google Sheets`.
3. Mở file vừa tải bằng Notepad, sao chép toàn bộ vào `Code.gs` thay nội dung mẫu, rồi lưu.
4. Ở danh sách hàm cạnh nút **Run / Chạy**, chọn **install**, bấm **Run**, xem và cấp quyền Google. Quyền dùng để đọc/ghi các Sheet, sao lưu trong Drive, gọi API web và cài lịch giờ. Không cần triển khai Web App công khai.
5. Chờ thông báo hoàn tất trong Execution log. Quay lại web và tải lại trang; mỗi nút sẽ hiện tháng và thời điểm cập nhật đã được Google xác nhận.

Để cập nhật ngay khi cần, mở Apps Script và chạy `syncNow`. Để dừng lịch, chạy `stopSync`. Nếu chạy lỗi, giữ nguyên file hiện tại, xem Executions và khắc phục theo thông báo; không đánh dấu đồng bộ thành công khi thiếu xác nhận ghi Google hoặc callback web.

## Cấu hình máy chủ

Máy chủ tự tạo khóa riêng khi quản trị tải bộ cài lần đầu; lưu hash để xác thực và bản mã AES-GCM bằng AUTH_SECRET để tải lại an toàn. Không cần bạn cấu hình biến Vercel thủ công. Có thể dùng GOOGLE_MIRROR_TOKEN tối thiểu 32 ký tự như một lựa chọn triển khai riêng. Giữ bí mật, không dùng mật khẩu Gmail/token Turso, không đưa vào NEXT_PUBLIC_*. Các route snapshot/callback xác thực Bearer token; status GET cần phiên web, setup cần quyền admin. Không cấp quyền cho các API hoặc bảng nhân sự khác.

## Giới hạn kiểm chứng

Đồng bộ một chiều theo giờ, không phải cập nhật tức thời sau từng lần lưu. Chỉ các tháng đang hoạt động được cập nhật tự động; tháng cũ đã lưu trữ không tự tính lại. Trang nền CTKTKT có thể vẫn báo chia cho 0 khi thiếu số liệu. Không sửa công thức cố định để che lỗi. Không coi bản mã và kiểm thử đạt là đã chạy thật: phải có lần Google cấp quyền, chạy install và đọc lại dữ liệu mới trên 9 file.
