# Giảm đọc lặp Turso — 20/10/2026

## Phạm vi và cơ chế

- Giữ công thức KPI, dữ liệu gốc, phân quyền và lịch Google mỗi giờ.
- `db/index.ts` chỉ đệm SELECT đơn bảng cho 6 nguồn vận hành. Tài khoản, quyền, nhân sự, Work PX, nhật ký sửa và khóa kết nối không được đệm.
- Dùng Next Data Cache dùng chung giữa các instance, khóa theo database, SQL, tham số và phiên bản dữ liệu. Mỗi đợt đọc vẫn kiểm tra bảng phiên bản nhỏ trên Turso; không khẳng định đã bỏ mọi truy vấn SQL.
- Thêm bảng `operational_read_versions`, chỉ chứa bộ đếm, không sao chép dữ liệu vận hành. Mỗi giao dịch ghi nguồn cập nhật bộ đếm trong cùng transaction. Lỗi ghi rollback cả dữ liệu lẫn phiên bản.
- Ghi theo ngày chỉ làm mất hiệu lực tháng bị ảnh hưởng. Ghi không xác định được phạm vi, sửa ngày hoặc thay schema làm mất hiệu lực toàn bảng. SQL phức tạp/nguồn ngoài danh sách không được đệm. Ngày không hợp lệ không được suy diễn thành một tháng khác.
- Các yêu cầu đồng thời giống nhau dùng chung một lần đọc. Kết quả được sao chép trước khi trả cho từng người gọi. Lỗi SQL không bị lưu trong cache; kết quả quá 1.8 MB đi trực tiếp để không vượt ngân sách một entry.
- Truy vấn giờ vận hành được chia theo tháng từ đúng mốc 01/01/2026. Các tháng đóng giữ lại cache khi tháng hiện tại đổi; không cắt ngắn thời gian lũy kế. Khoảng đặc biệt quá 24 tháng quay về một truy vấn như trước.
- Google snapshot cấp ETag gồm ngày Việt Nam, kỳ báo cáo, phiên bản nguồn và release. Apps Script gửi If-None-Match. Khi HTTP 304, dừng trước bước dựng/export báo cáo, không ghi Sheets và không gọi callback 9 lần. Chỉ lưu ETag sau khi đủ 9 file/callback thành công; lỗi một file sẽ được thử lại.
- Bản Apps Script mới giữ cấu hình/9 ID hiện tại, hàm kiểm chứng và trigger cũ. Không tạo lại file, không đổi OAuth hoặc chia sẻ.

## Kiểm chứng

- Synthetic SQLite + cache dùng chung: 100 lần đọc lặp qua 2 instance chỉ đọc nguồn nặng 1 lần; metadata phiên bản vẫn được đọc.
- 20 yêu cầu đồng thời: 1 lần đọc nguồn, 1 lần kiểm tra phiên bản trong cùng đợt.
- Sau ghi, instance khác thấy số mới ngay; tháng không bị sửa vẫn trúng cache.
- Đã kiểm tra rollback, yêu cầu cũ đang chạy không ghi đè cache của phiên bản mới, cache lỗi/quá lớn không lặp SQL thành công, SQL lỗi không được cache, tài khoản đổi quyền vẫn thấy hiệu lực ngay.
- Snapshot: 10 conditional GET không đổi không gọi lại exporter; đổi nguồn/ngày trả 200; chưa có quyền trả 401 trước khi đọc metadata.
- Bộ kiểm thử đầy đủ cuối trước phát hành: **422/422 đạt**; kiểm thử cache tập trung **9/9 đạt**. Lint các file thay đổi sạch. TypeScript nguồn đạt với cấu hình kiểm tra không lấy file `.next/types` bị lỗi sinh từ build Next cục bộ; không coi đây là xác nhận toàn bộ build Next đã đạt. Chưa gán tỷ lệ tiết kiệm quota production từ số đo synthetic.
- Vinext build đạt. Next production build (Turbopack) cục bộ đạt sau khi sửa biểu thức RegExp dùng chuỗi ghép, tránh lỗi minifier biến ký tự backtick trong template literal thành JavaScript sai cú pháp. Bản đầu cc1c64b thất bại khi collect page data; không đưa bản lỗi lên production. Kiểm thử cache sau sửa: 9/9 đạt.

## Vận hành và rollback

- Chỉ ghi nguồn qua `getRawDb()` để transaction tự cập nhật phiên bản. Hiện không có writer vận hành dùng Drizzle `getDb()` trong app/lib.
- Nếu sửa nguồn bằng công cụ SQL/script bỏ qua adapter: chạy `npm.cmd run cache:refresh` sau giao dịch. Lệnh chỉ tăng bộ đếm, không sửa số liệu. Không dùng truy cập bảng phiên bản để cấp quyền đọc dữ liệu.
- Cache là tối ưu, không phải bản sao lưu. Không xóa nguồn Turso khi đã có Sheets.
- Có thể đặt `CTKTKT_READ_CACHE=off` rồi redeploy để bỏ qua cache và conditional 304; giao dịch ghi vẫn duy trì phiên bản cho lần bật lại. Không cần xóa bảng/đổi khóa hoặc công thức để rollback.
- Không bỏ chỉ mục để giảm dung lượng trong lần tối ưu này; giữ chỉ mục field/date phục vụ quota đọc.

## Baseline provider đã xem trực tiếp

Turso Analytics, bộ lọc **Last 30 days**, ngày 20/10/2026: dashboard hiện **Developer**, Rows Read **504.84M / 2.50B** (khoảng 20.2%), Rows Written **602.95K / 25M**, Storage **18.79 MB / 9 GB**. Đây là số làm tròn trên UI, khác hạn mức Free được ghi nhận ngày 19/10. Phiên này chỉ đọc usage, không thay gói hoặc thanh toán. Ảnh: `.tmp/turso-usage-before-query-cache.png`.

## Trạng thái phát hành

Đối chiếu SHA, deployment, smoke test sau đăng nhập, Apps Script conditional GET và storage health trong biên bản kết thúc phiên. Không coi commit/push hoặc deploy Ready là bằng chứng quota thực tế đã giảm; cần so cùng cửa sổ Analytics sau vận hành.
