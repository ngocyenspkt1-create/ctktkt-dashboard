# Đọc công tơ than bằng Gemini

## Kích hoạt

### Dùng thử không cần quyền Vercel

Mở Đọc công tơ từ ảnh, nhập khóa vào ô Khóa Gemini tạm, chọn model tài khoản có quyền dùng rồi chọn ảnh. Khóa chỉ giữ trong React state của cửa sổ và gửi bằng header riêng qua HTTPS đến backend/Google; không lưu CSDL, localStorage hoặc Git. Đóng cửa sổ hoặc bấm Xóa khóa tạm để xóa giá trị khỏi state. Không dán khóa vào mã nguồn. Không tự lấy khóa từ chat.

Mặc định `gemini-3.8-flash`, theo tài liệu https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash hỗ trợ ảnh và structured output. Không cam kết model miễn phí: hạn mức/phí phụ thuộc khóa/tài khoản Google. Có thể nhập tên model khác được cấp quyền. Khi dùng khóa máy chủ, model vẫn do máy chủ quyết định, client không được đổi model bằng header.

Chế độ này không cần GEMINI_API_KEY/GEMINI_VISION_MODEL trong Vercel. Xóa ảnh theo truy cập vẫn hoạt động; lịch cron nền vẫn cần CRON_SECRET như bên dưới. Chưa thử API thật bằng khóa/ảnh người dùng.

Để cấu hình cố định: thu hồi khóa đã gửi trong chat, tạo khóa mới rồi đặt **GEMINI_API_KEY**, **GEMINI_VISION_MODEL** (model hỗ trợ ảnh trong tài khoản Google), **CRON_SECRET** trên Vercel Production và redeploy. Không dùng NEXT_PUBLIC, không commit khóa. Không có cả khóa server lẫn khóa tạm thì đọc ảnh trả 503; thiếu CRON_SECRET thì cron trả 401. Tham khảo https://ai.google.dev/gemini-api/docs/image-understanding . Chưa gọi Gemini thật khi phát triển.

## Sử dụng

Chọn ngày báo cáo, mốc 08/16/24 khi ảnh không có giờ; tải tối đa 24 JPEG/PNG/WebP (15 MB/ảnh gốc). Máy thu nhỏ về 1600px rồi gửi Google Gemini qua backend. Tối đa 72 lần đọc/giờ/tài khoản, đếm cả lần provider lỗi sau khi giữ quota.

Đọc tổng lũy kế tấn, không lấy tấn/giờ. Máy cấp theo nhãn 1A1…1F2/2A1…2F2, không đoán theo số gần giống. Giữ số AI gốc để đối chiếu; ô bảng theo quy tắc cũ cắt 2 số lẻ. Người dùng đối chiếu ảnh lớn cạnh bảng, sửa nếu cần, tích Ghi và bấm Điền. Sau đó bấm Lưu số liệu. Không ghi dữ liệu vận hành tự động chỉ từ AI.

Mở lại cửa sổ cùng ngày để xem ảnh đã lưu của chính tài khoản. Nhãn/số trong danh sách ảnh là kết quả AI ban đầu, không phải giá trị cuối đã lưu vào bảng. Chưa chia sẻ ảnh giữa tài khoản.

## Bốn mốc ca

Giờ Việt Nam 08h/16h/24h; ảnh mốc 08h ngày 25/10 hết hạn lúc 16h ngày 26/10. Không tính từ giờ upload. 24h thuộc ngày báo cáo nhưng kết thúc lúc 00h hôm sau. Ưu tiên EXIF, sau đó dấu giờ ảnh, cuối cùng mốc thủ công. Khác ngày báo cáo/quá hạn: chỉ đối chiếu local, không lưu ảnh và hiện cảnh báo.

Chặn truy cập ảnh hết hạn ngay bằng expires_at. Xóa vật lý khi đọc/lưu kho ảnh; cron Vercel 00:00 UTC hằng ngày dọn khi không có người dùng. **Xóa vật lý có thể trễ tối đa khoảng 24 giờ sau hết hạn**. Muốn xóa đúng từng mốc dùng scheduler hỗ trợ 01:00,09:00,17:00 UTC; không tự mở lịch trả phí. Sao lưu của nhà cung cấp có chính sách riêng.

Chỉ xóa coal_meter_photos, không xóa daily_inputs hay ảnh báo cáo khác. Kho tối đa 40 triệu ký tự base64; đầy/DB lỗi thì báo chưa lưu, không giả vờ thành công. Ảnh được kiểm tra header, trả qua API đăng nhập, no-store, không URL public.

## Kiểm thử và giới hạn

`node --test tests/coal-gemini.test.mjs tests/coal-meter-ocr.test.mjs`: mock Gemini, schema/đơn vị/lỗi provider, ca qua tháng/năm nhuận và helper công tơ. Chưa xác nhận Gemini thật, database production hay cron trên Vercel; cần khóa mới và ảnh công tơ thật trước dùng vận hành.
