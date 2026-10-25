# Công việc Phân xưởng PXVH1 — 13/10/2026

## Phạm vi đã thống nhất
- Tham khảo QLCV ngày 13/10/2026 qua phiên đăng nhập người dùng: danh sách trạng thái, menu Giao việc/Trả lại/Gia hạn, biểu mẫu chủ trì/phối hợp/theo dõi, chi tiết dải 5 bước, báo cáo/trao đổi/nhật ký. Chỉ xem; không gửi thay đổi hoặc tải/sao chép hồ sơ công ty. PX bổ sung sáu nhóm trạng thái, danh sách/bảng trạng thái, lọc vai trò, người theo dõi, trao đổi, gia hạn có lý do.
- Luồng PX: assigned → in_progress → pending_review (Đang kiểm tra); lãnh đạo approve → completed, request_feedback → waiting_response; chủ trì respond → pending_review. return từ kiểm tra trả về in_progress để bổ sung; decline từ assigned → returned, lãnh đạo phân công lại → assigned. Không chuyển trạng thái tùy ý; xác nhận cuối vẫn chỉ lãnh đạo có quyền.
- Người theo dõi có observerIds (tối đa 30, không trùng chủ trì/phối hợp), được xem việc và gửi trao đổi. Trao đổi không cập nhật tiến độ/lastReportDate, được lưu nhật ký; không báo cáo thay chủ trì. Chu kỳ dừng khi đang kiểm tra/chờ phản hồi/trả lại/đóng. Gia hạn chỉ lãnh đạo, yêu cầu hạn mới sau hạn cũ và lý do, giữ nguyên trạng thái/tiến độ/kỳ báo cáo. Tài khoản cũ/task cũ không observerIds vẫn hợp lệ. closedAt giữ tháng kết thúc khi có trao đổi sau đóng.
- Sửa/xóa nguồn họp/phát sinh: cương vị chính xác Quản đốc, Phó Quản đốc có quyền xem/sửa/xóa mềm/khôi phục nguồn, kiểm tra cương vị hiện hành qua DB. Không tự mở quyền giao/phê duyệt công việc. Các tài khoản có manage_work_px và admin vẫn giữ quyền nguồn. Xóa đưa vào bộ lọc Đã xóa; không xóa vật lý, không hủy việc đã phân công. Cần khôi phục trước khi sửa hoặc giao việc mới. Các mục đã có phân công vẫn được bảo vệ khi sửa biểu mẫu.
- Bổ sung nhiều nội dung/cuộc họp: biểu mẫu có Thêm nội dung và Xóa từng mục chưa phân công. Mỗi mục giữ mã riêng; chi tiết có Giao nội dung này để tạo việc với người chủ trì, hạn và chu kỳ riêng. Task lưu sourceId + sourceContentId; sửa cuộc họp không tự sửa task. Cuộc họp cũ hiển thị một mục legacy; không xóa mục có phân công kể cả task đã đóng. Việc gắn nội dung kiểm tra phiên bản nguồn ngay trong giao dịch để tránh phân công nhầm khi có chỉnh sửa đồng thời. Tối đa 50 mục, tổng văn bản 10.000 ký tự.
- Bổ sung 13/10/2026: người chủ trì cuộc họp nhập họ tên (tối đa 200 ký tự), hiện khi nguồn là Cuộc họp; lưu cùng nội dung và bản chụp nhật ký. Dữ liệu cũ không có trường này vẫn hợp lệ, hiển thị Chưa cập nhật. Thông tin được mang sang biểu mẫu phân công từ nội dung họp, độc lập với cá nhân chủ trì công việc.
- Bổ sung vào CTKTKT, dùng riêng PXVH1; không sửa công thức hoặc dữ liệu báo cáo hiện hữu.
- Cá nhân ghi nhận nội dung họp/yêu cầu phát sinh. Lãnh đạo xem xét, tách thành một hoặc nhiều việc.
- Quản đốc/Phó quản đốc phân công chủ trì, phối hợp, ngày giao, hạn, ưu tiên và chu kỳ báo cáo.
- Cá nhân tiếp nhận, báo cáo, đề nghị hoàn thành. Lãnh đạo xác nhận mới đóng; có thể trả lại, hủy có lý do hoặc mở lại.

## Cách sử dụng
1. Quản trị vào **Quản lý tài khoản → Phân quyền theo cương vị**.
2. Mọi tài khoản hoạt động đều có thể nhận và thực hiện việc được giao, không cần quyền Công việc PX. Chỉ cấp **Giao việc PX** cho lãnh đạo được giao nhiệm vụ phân công/phê duyệt. Quản trị hệ thống giữ toàn quyền hiện hữu.
3. Nhân sự được phân công lấy từ tất cả tài khoản đang hoạt động trên web, không lọc đơn vị. Tài khoản bị khóa không thể nhận việc mới hoặc truy cập; người cần đổi mật khẩu phải đổi trước khi sử dụng.
4. Cá nhân mở **Công việc Phân xưởng → Ghi nhận nội dung**, nhập ngày họp/phát sinh, tiêu đề và kết luận/yêu cầu. Được sửa nội dung của mình trước khi lãnh đạo xem xét.
5. Lãnh đạo mở **Họp & phát sinh**, chọn nội dung → **Phân công từ nội dung này**. Một nội dung có thể tạo nhiều việc độc lập. Ghi ý kiến **Đã xem xét** khi xử lý xong nội dung nguồn.
6. Tìm tên hoặc cương vị có dấu/không dấu trong ô người chủ trì và người phối hợp. Chọn một chủ trì, tối đa 30 phối hợp. Đổi từ khóa tìm không làm mất người đã chọn. API kiểm tra tài khoản còn hoạt động trước khi lưu.
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

## Giao diện theo QLCV công ty — 13/10/2026
- Sáu thẻ trạng thái dùng icon, màu và số lượng theo mẫu QLCV; font Arial và cỡ chữ dễ đọc, chỉ áp dụng trong module Công việc PX.
- Bảng có ưu tiên, nội dung, chủ trì, ngày giao, ngày hết hạn, báo cáo kế tiếp, trạng thái và menu thao tác; nhấp đúp hoặc nút xem mở chi tiết. Giữ bộ lọc tháng, phạm vi cá nhân và bảng trạng thái.
- Menu không làm thay đổi độ rộng cột. Bảng cuộn ngang trên màn hình hẹp để giữ ngày tháng dễ đọc. Không thay đổi nghiệp vụ, phân quyền hay công thức KPI.
- Kiểm tra local bằng dữ liệu giả: danh sách và menu; 375/375 tests, ESLint tệp giao diện và build Next.js đạt.
- storage:check OK: 13,91 MiB; 0,2717% mốc tham chiếu 5 GiB. Chưa có usage tài khoản Turso/Vercel để xác nhận giới hạn gói, lượt đọc/ghi hoặc usage Vercel.

- Bổ sung hiển thị toàn bộ description của từng công việc ngay dưới tiêu đề trong bảng danh sách; giữ xuống dòng, không giới hạn số dòng/ký tự hiển thị. Chỉ đổi giao diện, không đổi dữ liệu và nghiệp vụ.

- Đường nối và mũi tên giữa năm bước xử lý dùng màu xanh biển; tên cuộc họp/công việc in đậm, nội dung chi tiết in thường. CSS giới hạn trong module Công việc PX.

- Thanh lọc theo QLCV: hai ô ngày có icon lịch nền xanh, trạng thái và phễu xanh lá bên trái; phạm vi cá nhân, nút danh sách/bảng và tải lại bên phải. Hàng dưới xóa bộ lọc bên trái, tìm kiếm bên phải.
- Khoảng ngày giới hạn trong tháng đang chọn; áp dụng bằng nút phễu. Công việc lọc theo giao nhau của startDate/dueDate với khoảng chọn; nguồn lọc theo sourceDate. Toàn tháng giữ nguyên logic workInMonth, bao gồm chuyển tiếp. Xóa bộ lọc xóa cả khoảng ngày.

## Cấp quyền tham gia toàn bộ tài khoản — 13/10/2026
- Theo lựa chọn người dùng: thêm work_px (ghi nhận/nhận việc/báo cáo) vào cả 25 cấu hình cương vị hiện có. Đã xác minh 165/165 tài khoản có quyền hiệu lực (bao gồm admin theo vai trò). Không mở khóa tài khoản.
- Cập nhật trong giao dịch, đối chiếu từng cấu hình để bảo toàn role, permissions_version và mọi quyền khác, gồm manage_work_px. Snapshot trước cập nhật tại .tmp/work-px-grants-before.json (không đưa lên Git).
- Ma trận dùng tên đầy đủ Công việc Phân xưởng và Quản lý công việc Phân xưởng; giải thích riêng quyền tham gia và quyền phân công/xác nhận hoàn thành.

- Tên chủ trì xanh biển, tên phối hợp đen dưới chủ trì; cờ vàng bên trái tiêu đề khi còn 0–3 ngày tới hạn, không áp dụng công việc hoàn thành/hủy. Quá hạn đổi tiêu đề và nội dung sang đỏ trong danh sách, bảng trạng thái và chi tiết. Demo có mẫu sắp đến hạn và quá hạn; không sửa dữ liệu công việc thật.

## Tiếp nhận bằng bước 2 và báo cáo có định dạng/đính kèm — 14/10/2026
- Chỉ chủ trì của việc Chưa tiếp nhận được bấm số 2 để mở Chuyển trạng thái công việc. Đồng ý gửi accept với lời xác nhận tự động; Hủy/ESC không gửi. Giữ CAS phiên bản và phân quyền server.
- Báo cáo tiến độ đặt ngay dưới mô tả, trước nhật ký; Quill 2 (không CDN), chữ đậm/nghiêng/gạch chân, màu, tiêu đề, danh sách, căn lề, liên kết. HTML được lọc allowlist server khi lưu và khi đọc; không cho nhúng ảnh/video từ editor. Nội dung thường vẫn giữ cho tìm kiếm/lịch sử cũ.
- File được gửi cùng report/request_completion/respond, không upload rời; tối đa 3 file, 1 MiB/file, tổng 2 MiB/report. PDF, DOCX, XLSX, PPTX, TXT, CSV, PNG, JPG; kiểm tra extension/base64/signature/size. Chỉ cho tải xuống, nosniff + CSP sandbox; chưa có antivirus/quét nội dung tệp, nên chỉ nhận hồ sơ công việc tin cậy.
- Thêm bảng px_work_attachments, giữ file BLOB riêng khỏi WorkItem và snapshot. Giới hạn cứng 100 MiB toàn kho đính kèm, bảo vệ trong cùng transaction/CAS. File + event + thay đổi trạng thái hoặc cùng thành công hoặc không ghi. Không có file tạm/orphan khi báo cáo bị xung đột.
- Tải file /api/work-px/attachments?id=... yêu cầu phiên đăng nhập hợp lệ và canReadWork cho công việc gốc; tài khoản bị khóa/không liên quan không tải được. Không có URL tệp công khai, không gửi hồ sơ qua nhà cung cấp khác.
- Rollback code giữ bảng/file để tránh mất hồ sơ; cần sao lưu bảng items/events/attachments khi vận hành. Mọi thay đổi cấu hình dung lượng hoặc retention phải đánh giá riêng.
- Preview vẫn không lưu; có mẫu chủ trì là người dùng minh họa để thử mở hộp xác nhận và editor. Công cụ trình duyệt lỗi khởi tạo trong lần triển khai này nên chưa xác nhận trực quan sau đăng nhập.
- Kiểm chứng: 383/383 tests đạt, gồm tương tác React mô phỏng nút bước 2/Hủy/Đồng ý và gửi báo cáo, kiểm tra XSS/giới hạn tệp/ACL tải xuống/CAS/rollback. TypeScript, ESLint các tệp chức năng và build Next.js đạt. Chưa nghiệm thu trực quan bằng trình duyệt thật do lỗi khởi tạo công cụ.

## Sửa sáu lỗi và chuẩn bị triển khai — 19/10/2026
- Biểu mẫu giữ phiên bản gốc khi đang soạn; tải lại không ghép tiến độ cũ với phiên bản mới. Có cảnh báo xung đột và nạp lại sau xác nhận bỏ bản nháp.
- Chặn chuyển việc, mở biểu mẫu khác và gửi trùng khi đang lưu; editor khởi tạo muộn vẫn giữ trạng thái khóa. Chọn lại cùng việc giữ nguyên bản nháp và nhật ký.
- Tải lại cập nhật cả danh sách và nhật ký chi tiết; loại phản hồi cũ và phản hồi thuộc việc đã rời.
- Kiểm tra gói Office bằng cấu trúc ZIP/CRC, Content Types và phần chính tương ứng; giới hạn 2.000 mục và 20 MiB sau giải nén. Giữ giới hạn 3 tệp, 1 MiB/tệp, 2 MiB/báo cáo và lưu/tải riêng tư qua API hiện có.
- Thêm 10 kiểm thử hồi quy. Sau đồng bộ `github/main` tại `8f20af1`: 400/400 tests, TypeScript và build Next.js `--webpack` đạt; ESLint phạm vi sửa đạt. Không sửa công thức KPI, phân quyền hoặc schema DB.
- `storage:check` OK: 14,61 MiB, 15 bảng, 133.435 dòng; chưa xác minh hạn mức gói và usage tài khoản Turso/Vercel.
- Preview local bị timeout từ công cụ trình duyệt; chưa nghiệm thu đầy đủ thao tác ghi bằng tài khoản thật. Trạng thái deployment phải kiểm tra theo SHA sau khi push.
