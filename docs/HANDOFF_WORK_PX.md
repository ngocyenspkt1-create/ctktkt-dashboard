# Công việc Phân xưởng PXVH1 — 13/10/2026

## Phạm vi đã thống nhất
- Bổ sung nhiều nội dung/cuộc họp: biểu mẫu có Thêm nội dung và Xóa từng mục chưa phân công. Mỗi mục giữ mã riêng; chi tiết có Giao nội dung này để tạo việc với người chủ trì, hạn và chu kỳ riêng. Task lưu sourceId + sourceContentId; sửa cuộc họp không tự sửa task. Cuộc họp cũ hiển thị một mục legacy; không xóa mục có phân công kể cả task đã đóng. Việc gắn nội dung kiểm tra phiên bản nguồn ngay trong giao dịch để tránh phân công nhầm khi có chỉnh sửa đồng thời. Tối đa 50 mục, tổng văn bản 10.000 ký tự.
- Bổ sung 13/10/2026: người chủ trì cuộc họp nhập họ tên (tối đa 200 ký tự), hiện khi nguồn là Cuộc họp; lưu cùng nội dung và bản chụp nhật ký. Dữ liệu cũ không có trường này vẫn hợp lệ, hiển thị Chưa cập nhật. Thông tin được mang sang biểu mẫu phân công từ nội dung họp, độc lập với cá nhân chủ trì công việc.
- Bổ sung vào CTKTKT, dùng riêng PXVH1; không sửa công thức hoặc dữ liệu báo cáo hiện hữu.
- Cá nhân ghi nhận nội dung họp/yêu cầu phát sinh. Lãnh đạo xem xét, tách thành một hoặc nhiều việc.
- Quản đốc/Phó quản đốc phân công chủ trì, phối hợp, ngày giao, hạn, ưu tiên và chu kỳ báo cáo.
- Cá nhân tiếp nhận, báo cáo, đề nghị hoàn thành. Lãnh đạo xác nhận mới đóng; có thể trả lại, hủy có lý do hoặc mở lại.

## Cách sử dụng
1. Quản trị vào **Quản lý tài khoản → Phân quyền theo cương vị**.
2. Cấp **Công việc PX** cho cương vị cá nhân được tham gia; cấp thêm **Giao việc PX** cho cương vị Quản đốc/Phó quản đốc. Đây là hai quyền độc lập; không tự cấp từ tên cương vị. Quản trị hệ thống giữ hợp đồng toàn quyền hiện hữu.
3. Tài khoản cá nhân phải hoạt động, thuộc đơn vị `Vận hành 1` / `PXVH1` / `Phân xưởng vận hành 1`. Không đổi đơn vị hoặc cấp quyền thật trong lượt triển khai mã này.
4. Cá nhân mở **Công việc Phân xưởng → Ghi nhận nội dung**, nhập ngày họp/phát sinh, tiêu đề và kết luận/yêu cầu. Được sửa nội dung của mình trước khi lãnh đạo xem xét.
5. Lãnh đạo mở **Họp & phát sinh**, chọn nội dung → **Phân công từ nội dung này**. Một nội dung có thể tạo nhiều việc độc lập. Ghi ý kiến **Đã xem xét** khi xử lý xong nội dung nguồn.
6. Chọn một người chủ trì và các cá nhân phối hợp. Người được giao phải có quyền tham gia; nếu chưa có quyền, API từ chối lưu và yêu cầu quản trị cấp trước.
7. Chu kỳ `0` là không định kỳ; `1–365` là số ngày giữa các báo cáo. Kỳ đầu = ngày giao + chu kỳ; các kỳ sau = ngày báo cáo chủ trì gần nhất + chu kỳ. Kỳ cuối không vượt hạn thực hiện.
8. Người chủ trì nhập nội dung để **Tiếp nhận**, sau đó **Gửi báo cáo tiến độ**. Báo cáo phối hợp được lưu nhưng không thay đổi % tiến độ hoặc kỳ báo cáo của chủ trì.
9. **Đề nghị hoàn thành** chuyển sang chờ xác nhận, dừng nhắc báo cáo. % 100 tự nó không đóng việc. Lãnh đạo ghi ý kiến rồi **Xác nhận hoàn thành** hoặc **Yêu cầu bổ sung**.
10. Bộ lọc tháng gồm việc có thời gian thực hiện giao với tháng, việc chưa đóng chuyển tiếp và việc đóng trong tháng. Việc hủy được giữ để tra cứu, không xóa.

## Dữ liệu và quyền truy cập
- Cá nhân chỉ đọc nội dung mình tạo / chủ trì / phối hợp; lãnh đạo đọc toàn PXVH1.
- API đọc lại quyền hiện hành từ tài khoản, không dùng quyền ghi trong cookie cũ.
- Hai bảng mới `px_work_items`, `px_work_events` tạo khi tài khoản được phép lần đầu sử dụng API. Không tạo bảng hoặc ghi công việc thật trong bước kiểm thử local.
- Nhật ký lưu người thao tác, giờ UTC (hiển thị Việt Nam), nội dung và bản chụp dữ liệu mỗi lần thay đổi. Hiển thị 200 nhật ký gần nhất; toàn bộ lịch sử vẫn giữ trong DB.
- Lưu công việc và nhật ký cùng giao dịch. Kiểm tra version ngăn hai người ghi đè nhau.
- Chỉ trả danh mục nhân sự tối thiểu cần cho chức năng; không trả mật khẩu, email, điện thoại.
- Nội dung nguồn sửa sau khi phân công không tự sửa các việc đã giao. Điều chỉnh từng việc riêng để lưu lịch sử đúng.
- Dữ liệu công việc nội bộ cần quản lý theo chính sách đơn vị (CS-ATTT-KTAT-21 là bối cảnh chính sách, không phải chứng nhận tuân thủ). Cần rà soát quyền thật, sao lưu/phục hồi và thời hạn lưu trước khi dùng chính thức.

## Kiểm tra và trạng thái
- 361/361 kiểm thử toàn dự án đạt sau ghép github/main tại 1580453; 24/24 kiểm thử Công việc PX và phân quyền đạt (10 kiểm thử nghiệp vụ/lưu trữ công việc).
- TypeScript và ESLint phạm vi sửa đạt sau cập nhật cuối.
- Build Next.js dùng cấu hình Vercel đạt sau cập nhật cuối.
- Đã xem bảng, bộ lọc quá hạn, biểu mẫu phân công trên desktop và màn hình 390×844 bằng trình duyệt local, dữ liệu giả.
- Người dùng đã yêu cầu push lên web ngày 13/10/2026. Release qua github/main; kiểm tra trạng thái Vercel theo SHA commit. Chưa nghiệm thu giao diện bằng tài khoản thật.
- `storage:check` đã kết nối Turso: 13,84 MiB, 12 bảng, 127.776 dòng; script `OK` so với mốc tham chiếu 5 GiB (0,2702%). Chưa xác minh giới hạn gói thực tế, lượt đọc/ghi hoặc usage Vercel. Xem **Turso → Database → Usage**, **Vercel → Project → Usage**.

## Mở xem thử trên máy
- Server thử nghiệm đang chạy tại http://localhost:5174/work-px-preview, chỉ có dữ liệu giả.
- Khởi động lại nếu cần: mở terminal tại thư mục ctktkt-dashboard, chạy `node node_modules/next/dist/bin/next dev --port 5174`.
- Trang thật: http://localhost:5174/work-px (cần đăng nhập và quyền phù hợp).

## Tệp chính
- Trang `/work-px`; API `/api/work-px`.
- `components/work-px-client.tsx`, `components/work-px.css`: giao diện.
- `lib/work-px.ts`: nghiệp vụ/phân quyền; `lib/work-px-store.ts`: lưu và nhật ký.
- `tests/work-px.test.mjs`: dữ liệu giả và SQLite bộ nhớ, không dùng CSDL production.
- `/work-px-preview`: chỉ mở trong development, không đọc/ghi API, nhân sự minh họa. Production trả 404; proxy không mở công khai.

## Giới hạn bản đầu
- Cảnh báo trên màn hình, tự tải lại mỗi 60 giây khi tab đang mở; không email/Zalo/push nền.
- Nội dung và báo cáo dạng văn bản; chưa tải tệp đính kèm, xuất báo cáo tháng hoặc tích hợp tự động phần mềm công ty.
- Chưa có phân quyền theo nhiều PX, chưa có công việc con hoặc cơ chế báo cáo theo mốc cố định trong tuần/tháng.
- Khôi phục mã: gỡ module/nav/quyền mới theo bản Git; giữ hai bảng mới để không mất lịch sử. Sao lưu bảng trước thay đổi dữ liệu hoặc xóa module.
