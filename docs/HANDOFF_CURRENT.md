# Bàn giao trạng thái hiện tại dự án CTKTKT

**Ngày rà soát:** 18/09/2026  
**Phạm vi:** Đọc trạng thái Git, mã nguồn, tài liệu nghiệm thu và chạy lại các kiểm tra kỹ thuật. Không sửa chức năng, không thay đổi cơ sở dữ liệu, không commit/push.

## 1. Vị trí và trạng thái Git

- Thư mục ứng dụng: `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`
- Nhánh: `main`
- Commit hiện tại: `aea05b1`
- Nội dung commit: `fix(auth): make initial-users-data self-contained for Vercel TypeScript build`
- Remote bàn giao đúng: `github=https://github.com/ngocyenspkt1-create/ctktkt-dashboard.git`
- Đã `fetch github` và xác nhận `HEAD == github/main` tại commit trên.
- Đã deploy thành công lên Vercel production và kiểm tra `manifest.json` v0.4.21 hoạt động.

> Lưu ý: Sau khi tạo file này, `docs/HANDOFF_CURRENT.md` là file mới chưa commit.

## 2. Kiến trúc hiện tại

- Giao diện: React 19 + Next.js 16/Vinext + TypeScript + Tailwind CSS.
- API: route handlers trong `app/api`.
- Cơ sở dữ liệu: Turso/libSQL qua `@libsql/client/http`; mã SQL vẫn theo SQLite.
- Triển khai mục tiêu: Vercel.
- Xác thực: cookie JWT, bí mật lấy từ biến môi trường `AUTH_SECRET`.
- Các biến môi trường chính: `AUTH_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Tiện ích trình duyệt QLKT: Manifest V3, phiên bản `0.4.21`.

## 3. Chức năng đã có trong mã nguồn

### 3.1. Chỉ tiêu KTKT và dữ liệu sản xuất

- Nhập trực tiếp số liệu tháng cho 7 chỉ tiêu KTKT.
- Máy chủ tính kết quả, so sánh định mức và lưu lịch sử.
- Bảng dữ liệu sản xuất theo ngày, ghi chú và cảnh báo CE/CF.
- Kế hoạch năm và phân bổ phần còn lại theo sản lượng dự kiến.

### 3.2. Suất hao nhiệt PPA

- Trang `/ppa-heat-rate`.
- Đồng bộ 4 công tơ và 48 chu kỳ nửa giờ từ QLKT.
- Có phương án dự phòng: tải hoặc dán CSV.
- Tính PPA cho S1, S2 và toàn nhà máy; so sánh với suất hao nhiệt thực tế.
- Nhập, sửa và lưu nhận xét riêng cho S1/S2.
- Biểu đồ, bảng lịch sử và xuất workbook Excel.
- Chuẩn bị dữ liệu đồng bộ Google Sheet.

### 3.3. Báo cáo PMIS

- Trang `/pmis-report`.
- Theo dõi 5 chỉ tiêu cho hai tổ máy S1/S2.
- Đồng bộ QLKT một ngày hoặc theo khoảng tối đa 62 ngày/lần.
- Bảng dữ liệu theo ngày và hai biểu đồ S1/S2 đặt cạnh nhau.
- Mỗi chỉ tiêu dùng miền trục Y riêng; PG dùng miền 400–625 MW.

### 3.4. Nhập liệu và xuất BCSX

- Trang `/bcsx-report`.
- Nhập 48 điểm nửa giờ, hiển thị 3 ca song song.
- Điều hướng bằng Enter/mũi tên và dán nhanh dữ liệu từ Excel.
- Nạp số tổng ngày từ bảng `daily_inputs`; có thể sửa và lưu lại.
- Đồng bộ nhật ký sự kiện vận hành từ QLKT hoặc nhập tay bổ sung.
- Xuất file mẫu `BCSX_NMD_A0`, `BCSX_NMD_S1`, `BCSX_NMD_S2`.
- A0 được tính từ S1+S2 theo logic hiện có; than tồn kho dùng một giá trị chung, không cộng đôi.

### 3.5. Tài khoản và phân quyền

- Trang `/admin/users`.
- Có 25 Cương vị và 9 quyền chức năng chi tiết.
- Ma trận phân quyền theo Cương vị; có tìm kiếm/lọc người dùng.
- Thêm, sửa, khóa/mở khóa, đổi mật khẩu và xóa tài khoản.
- Mã nguồn hiện chứa bộ dữ liệu khởi tạo 163 tài khoản.

### 3.6. Tiện ích QLKT v0.4.21

- Kết nối dashboard Vercel/localhost với QLKT.
- Đọc công tơ PPA, số liệu sản xuất, cân bằng nhiệt và nhật ký sự kiện.
- Hai bản nguồn phải luôn đồng nhất:
  - `browser-extension/qlkt-sync`
  - `public/qlkt-sync-extension`
- File phát hành: `public/qlkt-sync-extension.zip`.

## 4. Kết quả kiểm tra ngày 18/09/2026

### Đạt

- `node --test tests/*.mjs`: **44/44 test đạt**.
- `npx.cmd tsc --noEmit`: **đạt 100% (0 lỗi)**; `initial-users-data.ts` đã tự chứa các kiểu dữ liệu và hàm băm, không phụ thuộc đuôi file.
- `npm.cmd run build`: **đạt**; build tạo đủ các trang và API hiện có.
- `git diff --check`: **đạt**.
- Đã fetch GitHub và xác nhận commit cục bộ trùng `github/main`.
- Vercel deployment: **đạt**; `manifest.json` trên live site trả về đúng version `0.4.21`.

### Chưa đạt

- `npm.cmd run lint`: **không đạt — 10 lỗi, 7 cảnh báo**.
  - Lỗi tập trung tại `admin-users-panel.tsx`, `daily-production-table.tsx`, `pmis-report.tsx`, `ppa-heat-rate-comparison.tsx`.
  - Chủ yếu là `react-hooks/set-state-in-effect` và truy cập `ref.current` trong lúc render.

## 5. Rủi ro cần xử lý trước khi dùng thật

### P0 — Mật khẩu và dữ liệu nhân sự

- `lib/auth/initial-users-data.ts` đang chứa mật khẩu khởi tạo dạng rõ trong mã nguồn.
- Có 163 tài khoản; 162 tài khoản dùng chung một mật khẩu mặc định.
- Dù mật khẩu được băm bằng `scrypt` khi ghi vào cơ sở dữ liệu, việc để mật khẩu rõ trong Git là không phù hợp để vận hành thật.
- Không ghi lại giá trị mật khẩu trong tài liệu hoặc trao đổi tiếp theo.

**Việc cần làm:**

1. Loại toàn bộ mật khẩu rõ khỏi repository.
2. Sinh mật khẩu tạm riêng/ngẫu nhiên hoặc luồng đặt mật khẩu ban đầu.
3. Buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
4. Đổi ngay mọi mật khẩu đã từng đưa vào repository nếu dữ liệu đã được nạp lên hệ thống thật.
5. Rà soát việc lưu họ tên, email, số điện thoại và mã nhân viên theo yêu cầu bảo vệ dữ liệu nội bộ.

### P0 — Phân quyền API chưa đúng mức chi tiết

- `lib/auth/server.ts::requireEditor()` chấp nhận người dùng có bất kỳ quyền chỉnh sửa nào.
- Các API `daily-inputs`, `measurements`, `ppa-heat-rate` và `ppa-heat-rate/notes` đang dùng guard chung này.
- Vì vậy người chỉ có một quyền, ví dụ `edit_bcsx`, vẫn có thể gọi trực tiếp API sửa PPA hoặc dữ liệu tháng dù giao diện đã ẩn/khóa nút.
- Quyền `sync_qlkt` chưa được kiểm tra nhất quán tại phía máy chủ/giao diện.

**Việc cần làm:** thay `requireEditor()` bằng `requirePermission(...)` đúng cho từng API và bổ sung test API 401/403 cho từng quyền.

### P1 — Sai lệch số lượng nhân sự

- Tài liệu và nhiều nhãn giao diện ghi **124 nhân sự**.
- Dữ liệu và test hiện khẳng định **163 tài khoản**.
- Cần xác nhận danh sách chính thức rồi sửa đồng bộ tài liệu, giao diện và tên kiểm thử.

### P1 — Chưa có đủ bằng chứng nghiệm thu vận hành

- Chưa nghiệm thu trọn luồng bằng phiên đăng nhập QLKT thật cho toàn bộ chức năng v0.4.21.
- Chưa xác nhận đầy đủ trên dữ liệu thật tại Vercel + Turso và nhiều người dùng đồng thời.
- Chưa có bằng chứng hoàn chỉnh về nhật ký người sửa dữ liệu, sao lưu/khôi phục, rollback và giám sát lỗi.
- Chưa thực hiện kiểm thử bảo mật độc lập.

## 6. Chức năng còn thiếu theo lộ trình

- Chưa tự động xuất file **Chỉ tiêu kinh tế kỹ thuật** đầy đủ.
- Chưa có form **nước bổ sung theo ca**.
- Chưa hoàn tất nghiệm thu từng trường QLKT/PMIS bằng dữ liệu vận hành thật.
- Việc đồng bộ Google Sheet thật cần được xác nhận trong môi trường được phép, tránh ghi nhầm báo cáo chính thức.

## 7. Thứ tự đề xuất cho phiên làm việc tiếp theo

1. Giữ nguyên dữ liệu thật; tạo nhánh/phạm vi sửa riêng cho bảo mật tài khoản.
2. Loại mật khẩu rõ, thiết kế cơ chế cấp/đổi mật khẩu an toàn.
3. Sửa phân quyền từng API và viết test 401/403 theo ma trận quyền.
4. Xác nhận số lượng nhân sự chính thức là 124 hay 163; sửa tài liệu và UI.
5. Sửa lỗi TypeScript và lint cho đến khi tất cả kiểm tra đạt.
6. Chạy nghiệm thu có kiểm soát với QLKT thật, Vercel và Turso; dùng một ngày mẫu đã biết kết quả.
7. Ghi biên bản đối chiếu đầu vào, kết quả web và file Excel làm tay trước khi cho dùng chính thức.
8. Sau khi nền tảng ổn định mới phát triển tiếp file Chỉ tiêu KTKT và form nước bổ sung theo ca.

## 8. Các lệnh kiểm tra an toàn

Chạy trong `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`:

```powershell
git -c safe.directory=C:/Users/HP/Downloads/CTKTKT/ctktkt-dashboard status --short --branch
node --test tests/*.test.mjs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git -c safe.directory=C:/Users/HP/Downloads/CTKTKT/ctktkt-dashboard diff --check
```

Không chạy migration, seed dữ liệu, commit hoặc push nếu người dùng chưa yêu cầu rõ. Trước khi sửa phải đọc file này, `docs/ACCEPTANCE.md` và kiểm tra lại working tree vì trạng thái có thể đã thay đổi.

## 9. Bổ sung sau bàn giao — Một nút đồng bộ toàn bộ BCSX

Theo yêu cầu người dùng, trang `/bcsx-report` đã được gom còn một nút **“Đồng bộ toàn bộ S1 & S2”** ở đầu trang:

1. Gọi luồng `SYNC_ALL` để lấy 7 số liệu tổng ngày cần cho BCSX: `B`, `C`, `H`, `I`, `AE`, `AF`, `AR`.
2. Kiểm tra đủ mã và đúng ngày trước khi thay đổi dữ liệu đang hiển thị.
3. Điền đồng thời số liệu tổng ngày cho cả S1 và S2.
4. Tự chuyển sang luồng `SYNC_BCSX_EVENTS` để lấy nhật ký sự kiện cho cả hai tổ máy.
5. Khi đã đủ cả hai nguồn, gọi một API `/api/bcsx-sync` để lưu cùng lượt 7 số tổng ngày và nhật ký S1/S2 bằng một batch cơ sở dữ liệu.
6. Bỏ hai nút rời “Lấy từ Dữ liệu các tháng” và “Đồng bộ sự kiện từ QLKT”.

Quy trình sử dụng là: chọn ngày, bấm một nút đồng bộ, sau đó có thể xuất ngay ba file A0/S1/S2. Hệ thống chỉ tự lưu khi đã lấy đủ 7 mã bắt buộc, đúng ngày và nhận được nhật ký của cả hai tổ máy. Phần thông số nửa giờ tiếp tục nhập tay/dán Excel vì chưa có nguồn QLKT đã xác nhận.

Đối chiếu ba template đã phát hiện và sửa lỗi thiếu mốc cuối: danh sách giờ phải có đúng **48 mốc**, gồm `00:30` đến `23:30` và dòng `23:59` tại hàng 58. Bộ kiểm thử xuất file kiểm tra riêng A0/S1/S2: template nhúng phải byte-identical với file template nguồn; toàn bộ merge, khổ in, lề, header/footer, kích thước hàng/cột và style ô phải giữ nguyên; chỉ các ô dữ liệu cho phép mới được thay đổi.
