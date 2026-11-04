# CTKTKT PXVH1 — Đọc trước khi chuyển dự án

Gói bàn giao ngày 04/11/2026. Mã nguồn và bản sửa local mới nhất, gồm mục **Sao lưu & nạp dữ liệu**, nằm trong gói. Gói này không tự chuyển website đang chạy hoặc dữ liệu trên Turso.

## 1. Chạy dự án tại nơi mới

Ứng dụng đầy đủ React 19 / Next.js 16.3.4, có API phía máy chủ, cookie đăng nhập và Turso/libSQL. Nơi triển khai phải hỗ trợ Node.js và Next.js; hosting chỉ có HTML hoặc PHP không chạy được nguyên dự án này. Có thể tiếp tục xây dựng trên một công cụ AI khác nếu công cụ đó cho nhập mã nguồn và hỗ trợ phần máy chủ này.

Khuyến nghị dùng Node.js 24 LTS; yêu cầu tối thiểu của dự án là 22.13.0. Nếu cài trong môi trường lạ, dùng một thư mục riêng, không chép node_modules từ máy cũ.

```sh
npm ci
```

Sao chép `.env.example` thành `.env.local`, điền cấu hình theo mục 2. Sau đó:

```sh
npm run dev:next
```

Mở http://127.0.0.1:5174. Xem riêng giao diện mới tại http://127.0.0.1:5174/wb-preview?view=data-backup (chỉ development, API quản trị vẫn cần đăng nhập).

Chạy bản production:

```sh
npm run build:next
npm run start:next
```

Mặc định cổng 3000 hoặc theo biến PORT do máy chủ cấp. Nếu dùng Vercel, chọn framework Next.js, Install Command `npm ci`, Build Command `npm run build:next`; có thể dùng root config vercel.json hiện có và đổi Build Command trong cấu hình dự án đích. Với máy chủ Node thông thường, dùng lệnh build/start bên trên. Cấu hình HTTPS/domain và chuyển tiếp yêu cầu tới Node theo nền tảng đích.

Các lệnh `npm run dev`, `npm run build`, `npm start` gốc vẫn là đường chạy Vinext/Cloudflare/Sites kế thừa. Khi chuyển sang máy chủ Next.js, dùng các lệnh có hậu tố `:next` phía trên. README.md gốc mô tả starter Sites cũ; ưu tiên tài liệu này cho phương án Next.js/Turso hiện tại.

## 2. Cấu hình phải nhập riêng

Mẫu `.env.example` trong gói chỉ có tên biến, không có giá trị thật.

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: lấy từ chủ sở hữu database Turso. Lớp dữ liệu hiện tại là db/index.ts, không phải Cloudflare D1 mặc dù còn file cấu hình D1 cũ.
- `AUTH_SECRET`: bí mật ký phiên đăng nhập và tạo khóa mã hóa Gemini dùng chung. Nếu tiếp tục dùng cùng database và muốn giải mã khóa Gemini đã lưu, chuyển đúng giá trị hiện tại qua kênh cấu hình riêng. Nếu tạo giá trị mới, người dùng cần đăng nhập lại và nhập/lưu lại khóa Gemini dùng chung.
- `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`: tùy chọn fallback phía server. Hoặc nhập khóa trong giao diện cấu hình Gemini. Không đặt khóa vào mã frontend.
- `CRON_SECRET`: cho endpoint dọn ảnh. Vercel có lịch trong vercel.json; máy chủ khác cần cấu hình bộ lập lịch gọi `/api/cron/coal-photos` với xác thực theo route. Giữ chính sách ảnh 4 mốc ca, không đổi thành giữ vô hạn.
- Các biến Google Sheets / mirror / API đọc dữ liệu: chỉ thiết lập nếu tiếp tục dùng tích hợp tương ứng. Xem `.env.example`, docs và các route liên quan. Nếu để trống, không mặc định coi tích hợp đã hoạt động.

Không có bí mật hoặc dữ liệu server thật trong gói này. Tệp tạm, cấu hình trình duyệt, lịch sử Git, file môi trường thật và thư mục dependency/build không được đưa vào ZIP. npm ci sẽ cài lại dependency từ package-lock.json.

## 3. Chuyển dữ liệu

### Tiếp tục cùng database Turso

Đây là cách giữ đầy đủ tài khoản, phân quyền, số liệu, metadata và cấu hình. Điền kết nối Turso của hệ thống hiện tại ở nơi mới. Trước khi dùng để thử nghiệm hoặc sửa schema, nên tạo một bản sao database riêng bằng công cụ quản lý Turso của chủ sở hữu để bản thử không ghi vào dữ liệu vận hành thật. Gói nguồn không cung cấp các thông tin đăng nhập đó.

### Chuyển sang database mới

Để giữ toàn bộ hệ thống, cần bản sao/export đầy đủ database từ nhà cung cấp Turso và nhập vào database đích, gồm bảng tài khoản và quyền; sau đó trỏ biến môi trường sang database đích. Không phát lại toàn bộ migration vào database đã có dữ liệu hoặc xem các file drizzle cũ là bản sao database hiện hành. Các migration động trong lib/auth, lib/water-report, lib/chemical-usage, coal-photo-store và các module khác bổ sung schema khi chạy; chỉ file drizzle ban đầu không thể đại diện cho mọi cột hiện tại.

Mục mới **Hệ thống → Sao lưu & nạp dữ liệu** (/admin/data-backup) có thể dùng cho số liệu vận hành: tải JSON theo khoảng ngày/tất cả; tệp lớn chia theo tháng; kiểm tra trước rồi xác nhận nạp. Mặc định chỉ thêm bản ghi thiếu; ghi đè là lựa chọn riêng. Mỗi tệp tối đa 3 MB / 12.000 dòng. Khôi phục sự kiện/hóa chất/chỉ tiêu kỳ dựa trên ID, nên dùng bản sao thuộc cùng hệ thống, không ghép hai database độc lập.

Bản sao JSON đó KHÔNG gồm tài khoản, mật khẩu, phân quyền, khóa API, ảnh, audit lịch sử hay cache. Vì vậy không dùng nó thay cho bản clone database đầy đủ khi chuyển cả hệ thống. Chức năng này mới có trong mã local của gói, chưa có trong bản production nếu chưa được triển khai.

## 4. Domain mới và các kết nối liên quan

- Kiểm tra extension trong browser-extension/ và public/qlkt-sync-extension, public/nkvh-ppa-extension: host permissions, URL web đích và bản ZIP extension cần được cập nhật theo domain đích, rồi phát hành lại nếu đổi domain. Không tự đoán domain mới.
- Google Apps Script/Sheets, cron, tích hợp website khác và CORS/origin allowlist cần kiểm tra lại URL triển khai. Các URL cũ vẫn nằm trong mã nguồn/tài liệu để tham chiếu, không phải xác nhận đã chuyển tích hợp.
- Giao diện hiện chỉ có chế độ sáng. Không tự đưa lại nền tối hoặc hiệu ứng menu đã bị người dùng yêu cầu bỏ.
- Module Công việc Phân xưởng đã được tách/gỡ; không khôi phục route cũ chỉ vì gặp tài liệu lịch sử. Bảng database lịch sử có thể vẫn còn và phải giữ khi clone đầy đủ.

## 5. Bàn giao cho AI tiếp tục

Đọc `docs/AI-FIX-LOG.md` trước: các mục mới nhất ở đầu tài liệu ghi thay đổi và giới hạn đã kiểm chứng. Xem tiếp `docs/DATA-LOADING-AND-PERMISSIONS.md`, rồi mã thực tế. Một số HANDOFF cũ ghi trạng thái tại thời điểm trước đây, không được coi mọi thông tin cũ là hiện trạng.

Các file chính của phần mới: lib/data-backup.ts, app/api/admin/data-backup/route.ts, app/admin/data-backup/page.tsx, components/data-backup-panel.tsx và CSS module, tests/data-backup.test.mjs. Chỉ quản trị có quyền tải/nạp; nạp có preview/xác nhận, checksum, giới hạn body và giao dịch nguyên tử. Không nới quyền hoặc thử nạp dữ liệu giả vào production.

Trước khi bàn giao gói: bản dựng Next.js Webpack/TypeScript và toàn bộ suite có sẵn đã đạt trong lượt làm chức năng sao lưu; 8 kiểm thử sao lưu SQLite thật đạt, gồm vòng tải JSON → kiểm tra → nạp và rollback. Giao diện được xem ở local. Chưa xác minh đăng nhập, kết nối database hoặc triển khai trên nền tảng đích vì chưa có nền tảng/domain/cấu hình đích.

Kiểm tra tại nơi tiếp nhận:

```sh
node --test tests/data-backup.test.mjs
npm test
npm run build:next
```

Sau đó kiểm tra đăng nhập bằng tài khoản sẵn có, quyền từng cương vị, dữ liệu ngày trước/sau, công tơ than/nước và hiệu chỉnh, xuất Excel, Google Sheets/extension/cron nếu sử dụng. Chỉ kiểm tra nạp/ghi đè trên database thử nghiệm riêng hoặc dữ liệu thực đã được chủ sở hữu đồng ý.

## 6. Kiểm tra gói

TRANSFER_MANIFEST.json liệt kê file, dung lượng và SHA-256 từng file, kèm commit nền và danh sách thay đổi local đi cùng gói. ZIP có tệp .sha256 bên cạnh để đối chiếu. Gói không chứa thư mục .git nhưng giữ nhật ký sửa và tài liệu bàn giao.

Tạo lại gói sau các lần sửa tiếp theo bằng `npm run package:transfer`. Gói xuất ra thư mục outputs/transfer, không sửa/xóa dự án gốc và không tự đẩy GitHub hoặc triển khai nơi khác.
