# Đồng bộ 9 Google Sheets

Web là nguồn chính. Bản Google Sheets là bản xem theo tháng hiện tại, cập nhật mỗi giờ bằng tài khoản chủ sở hữu. Sửa trên Sheets không nhập ngược về web. Chỉ dữ liệu thay đổi mới ghi lại; không polling mỗi vài giây. Khi đổi tháng, Apps Script lưu bản sao riêng tư của từng file trước khi cập nhật tháng mới. Không thay đổi quyền chia sẻ.

## Cấp quyền một lần

1. Đăng nhập web bằng tài khoản quản trị. Mở `/api/google-mirror/setup` để tải `CTKTKT_Google_Sheets.gs`. File chứa mã kết nối riêng: không gửi vào chat, email hoặc GitHub.
2. Đăng nhập https://script.google.com bằng **yen.nn.cbsxdh1@gmail.com**, chọn **New project / Dự án mới**, đặt tên `CTKTKT – Đồng bộ 9 Google Sheets`.
3. Mở file vừa tải bằng Notepad, sao chép toàn bộ vào `Code.gs` thay nội dung mẫu, rồi lưu.
4. Trong **Dịch vụ / Services**, bấm **+**, chọn **Google Sheets API**, phiên bản **v4**, giá trị nhận dạng **Sheets**, rồi **Thêm**. Bỏ qua bước này nếu đã thấy dịch vụ Sheets. Lần cài thực tế ngày 20/10/2026 bị HTTP 403 ở cả 9 file trước khi bật dịch vụ này; sau khi bật đã ghi được.
5. Ở danh sách hàm cạnh nút **Run / Chạy**, chọn **install**, chờ bộ chọn cập nhật xong rồi bấm **Run**, xem và cấp quyền Google. Quyền dùng để đọc/ghi các Sheet, sao lưu trong Drive, gọi API web và cài lịch giờ. Google yêu cầu quyền cho toàn bộ Drive/Sheets, rộng hơn 9 ID mà mã xử lý. Không cần triển khai Web App công khai.
6. Chờ thông báo hoàn tất trong Execution log. Không chạy install chồng lên lần đang chạy: một lần có thể thoát sớm do khóa đồng bộ trong khi lần trước vẫn còn chạy. Kiểm tra cả Executions và callback của đủ 9 file.
7. Quay lại web và tải lại trang; mỗi nút sẽ hiện tháng và thời điểm cập nhật đã được Google xác nhận.

Để cập nhật ngay khi cần, mở Apps Script và chạy `syncNow`. Để dừng lịch, chạy `stopSync`. Nếu chạy lỗi, giữ nguyên file hiện tại, xem Executions và khắc phục theo thông báo; không đánh dấu đồng bộ thành công khi thiếu xác nhận ghi Google hoặc callback web.

## Giảm truy vấn khi nguồn không đổi

Bộ cài đã bổ sung conditional GET: `syncNow` lưu ETag sau khi cả 9 file được xác nhận, gửi lại ở lần sau; HTTP 304 sẽ bỏ qua dựng báo cáo và cập nhật Sheets. Lịch vẫn mỗi giờ. `install` xóa ETag trước lần chạy đầu; không chạy install chồng lên một sync đang chạy. Thời điểm hiển thị trên web là lần snapshot được xác nhận gần nhất, không phải đồng hồ kiểm tra mỗi giờ khi dữ liệu không đổi.

Cache nguồn chỉ được tái sử dụng khi bộ đếm phiên bản trong Turso khớp. Sửa số liệu trên web cập nhật phiên bản trong cùng giao dịch. Nếu sửa trực tiếp database bằng công cụ khác, cần chạy `npm.cmd run cache:refresh`. Xem `HANDOFF_QUOTA_SAVING_2026_10_20.md`.

## Cấu hình máy chủ

Máy chủ tự tạo khóa riêng khi quản trị tải bộ cài lần đầu; lưu hash để xác thực và bản mã AES-GCM bằng AUTH_SECRET để tải lại an toàn. Không cần bạn cấu hình biến Vercel thủ công. Có thể dùng GOOGLE_MIRROR_TOKEN tối thiểu 32 ký tự như một lựa chọn triển khai riêng. Giữ bí mật, không dùng mật khẩu Gmail/token Turso, không đưa vào NEXT_PUBLIC_*. Các route snapshot/callback xác thực Bearer token; status GET cần phiên web, setup cần quyền admin. Không cấp quyền cho các API hoặc bảng nhân sự khác.

## Giới hạn kiểm chứng

Đồng bộ một chiều theo giờ, không phải cập nhật tức thời sau từng lần lưu. Chỉ các tháng đang hoạt động được cập nhật tự động; tháng cũ đã lưu trữ không tự tính lại. Trang nền CTKTKT có thể vẫn báo chia cho 0 khi thiếu số liệu. Không sửa công thức cố định để che lỗi. Không coi bản mã và kiểm thử đạt là đã chạy thật: phải có lần Google cấp quyền, chạy install và đọc lại dữ liệu mới trên 9 file.

## Trạng thái đã cài ngày 20/10/2026

- Dự án đang dùng: [CTKTKT – Đồng bộ 9 Google Sheets](https://script.google.com/home/projects/1nYfMO45skyFQ0X2YHdWvNrzB3EZSPv5_wtrKCNYZE4Yj4oW2YynKNEq3/edit), tài khoản yen.nn.cbsxdh1@gmail.com. Giữ nguyên dự án và 9 file hiện có.
- Đã cấp đủ quyền, bật Sheets API v4, chạy install thành công; có đúng 1 trigger `syncNow`, **1 giờ một lần**. Chưa chờ tới lần trigger chạy theo giờ đầu tiên.
- Callback đủ 9/9 file, kỳ `2026-10`, `syncedAt=2026-10-20T08:17:51.662Z` (15:17:51 giờ Việt Nam). Đây là thời gian tạo snapshot, không phải thời gian hoàn tất ghi cuối cùng.
- `verifyMirror` đã đọc lại Google bằng Sheets API: **435 vùng trên 156 trang tính, 574270 ô trong vùng đồng bộ (gồm ô trống), 32498 công thức, 0 sai khác**, hash nguồn khớp cả 9 file. Nhật ký lần đầu ghi nhãn `tabs=435`, thực chất là số vùng: mỗi trang BCSX có 4 vùng. Đối chiếu công thức bỏ qua khoảng trắng ngoài chuỗi/tên sheet được trích dẫn, số dùng sai số nhỏ; không thay thế việc thẩm định kết quả tính toán kỹ thuật hoặc dữ liệu còn thiếu.
- Đã sửa riêng cách truyền công thức vào Google: thêm khoảng trắng sau dấu phẩy ngoài nội dung trích dẫn. Vùng `vi_VN` từng đọc `IFERROR(D6/B6/10,0)` thành `IFERROR(D6/B6/10)`; sau sửa, 378 khác biệt của file dữ liệu đã hết. Không đổi ý nghĩa công thức KPI. Chỉ file dữ liệu được buộc ghi lại để khắc phục.
- Lần cài ban đầu đã áp dụng bản sửa công thức trực tiếp vào Apps Script và nguồn local, chưa phát hành web lại tại thời điểm đó. Đợt giảm truy vấn tiếp theo đưa bản sửa này cùng conditional GET vào bộ cài; xem trạng thái phát hành trong `HANDOFF_QUOTA_SAVING_2026_10_20.md`. Giữ nguyên cấu hình và 9 file khi cập nhật dự án đã cài.
- Hàm kiểm chứng và nhật ký không chứa khóa nằm tại `.tmp/verify-google-mirror.gs`, `.tmp/google-mirror-readback-log.txt`; bằng chứng ảnh `.tmp/google-mirror-readback-ok.png`, `.tmp/google-mirror-hourly-trigger.png`.
- Storage check sau đồng bộ: **OK, 17.91 MiB, 17 bảng, 134332 dòng**. Trình duyệt chưa đăng nhập Turso/Vercel nên chưa đọc được usage dashboard. Kiểm tra thủ công: **Turso → yennn → Analytics**; **Vercel → qlkt1 → Usage**. Không suy diễn quota đọc/ghi từ dung lượng.
