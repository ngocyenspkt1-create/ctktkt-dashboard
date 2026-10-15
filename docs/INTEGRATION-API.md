# API chỉ đọc cho pxvh1.infinityfree.me

## Kích hoạt

Chạy `node scripts/create-read-api-key.mjs` một lần. Khóa bí mật và SHA256 nằm trong `.sites-runtime/private/pxvh1-read-api-key.json` (gitignored). Không gửi file này lên GitHub hoặc đặt trong public.

1. Chủ dự án đặt giá trị SHA256 vào biến môi trường **PXVH1_READ_API_KEY_SHA256** ở Vercel Production, rồi redeploy.
2. Chỉ lưu **key** ở cấu hình PHP/server của web nhận. Không đặt trong JavaScript, URL hay log.
3. Backend PHP gọi GET qua HTTPS với header `Authorization: Bearer <key>`.

Endpoint: `/api/integration/v1/operating-data?dataset=pmis&period=2026-10` hoặc `dataset=ppa`. Bắt buộc chọn một tháng. Không có CORS cho frontend; Origin không chứng minh danh tính server. Bất kỳ ai có khóa đều có thể đọc hai dataset nên giữ khóa bí mật.

Response JSON: version, dataset, period, entries. PMIS gồm 4 chỉ tiêu DA–DH và tỷ lệ NH3 của S1/S2. PPA gồm thực tế/PPA/chênh lệch/phần trăm/trạng thái, đơn vị kJ/kWh. Không trả ghi chú, tên tài khoản, file nguồn hoặc bảng đầu vào thô. Thiếu dữ liệu trả null, không bịa giá trị 0.

Hiện SHN thực tế và NH3 được suy ra từ dữ liệu KTKT đã lưu và helper liên kết; chưa kiểm tra tương đương với phần tổng hợp động từ công tơ/ca trên màn hình báo cáo. Không dùng dữ liệu này cho quyết định vận hành trước khi đối chiếu thực tế.

Chỉ GET, không quyền ghi. 401 nếu khóa sai/không cấu hình, 400 nếu query sai, 503 nếu kho dữ liệu không truy cập được. Cache-Control no-store. Giới hạn một tháng mỗi request; chưa có rate limit phân tán. Web nhận nên cache server 5 phút và không polling từng giây.

Thu hồi: xóa/đổi PXVH1_READ_API_KEY_SHA256 rồi redeploy. Khóa cũ lập tức vô hiệu trên deployment mới. Chưa kích hoạt production khi chưa cấu hình biến môi trường và triển khai.
