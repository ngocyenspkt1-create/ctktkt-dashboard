# Google Sheets — quyền xem theo đường link, 22/10/2026

Người dùng đã chọn: ai có link đều xem/tải được, kể cả không có tài khoản web. Chỉ chủ sở hữu sửa bản gốc; không thay công thức, dữ liệu hoặc tạo lại 9 file. Xuất báo cáo trên web giữ nguyên.

Thay đổi nguồn: mở link `/view`, giải thích quyền xem/tải trên web; bổ sung hàm Apps Script `configureViewerAccess()` độc lập với `syncNow`. Hàm này kiểm tra chủ sở hữu, phát hiện quyền sửa kế thừa từ thư mục, chuyển quyền không phải chủ sở hữu thành reader, cấp anyone/reader không cho tìm kiếm và cho phép tải/in/sao chép. Đọc lại quyền sau thay đổi; có lỗi không báo hoàn tất. Không đụng ô, không chạy install, không xuất lại 9 báo cáo. `syncNow`, ETag/304, hash từng file và lịch theo giờ được giữ nguyên.

Chạy hàm trong dự án Apps Script hiện hữu sau khi thêm phần mã quyền; không cần cài lại trigger. Các bản lưu tháng trước không được tự mở quyền theo link.

Đã kiểm tra trước thay đổi: cả 9 file và thư mục cha chỉ có chủ sở hữu. Kiểm thử trên bản nguồn riêng từ HEAD 8a6fed3 + đúng 6 tệp phát hành: 425/425 đạt. Các thay đổi audit chưa phát hành được giữ riêng. Kiểm tra kiểu dữ liệu/triển khai/quyền thực tế sẽ bổ sung khi có kết quả.

Thêm tùy chọn `npm.cmd run storage:check -- --light`: kiểm tra kết nối, trang lưu trữ và danh sách bảng, không COUNT toàn bảng, không giả định hạn mức gói. Hạn mức/kỳ hiện tại cần đọc từ Turso/Vercel.

Hoàn tác mã bằng revert commit phát hành. Hoàn tác quyền Google Drive là bước riêng: đổi General access về Restricted trên đúng 9 file; không hoàn tác dữ liệu hoặc công thức. Đổi quyền xem theo link không giới hạn việc người nhận chuyển tiếp link.
