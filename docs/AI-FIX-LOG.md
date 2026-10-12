# Nhật ký kiểm tra và sửa lỗi

## 2026-10-12

### Phạm vi

- Repository: `ngocyenspkt1-create/ctktkt-dashboard`
- Mục tiêu: kiểm tra lỗi dự án, sửa lỗi có thể tái hiện, và để lại thông tin đủ rõ cho AI tiếp tục xử lý.

### Đã kiểm tra

- Xác định dự án là React/Next-compatible chạy qua Vinext/Vite, dùng Drizzle và các test Node `.mjs`.
- Đã chạy `npm run lint`: chưa chạy được vì dependency chưa được cài hoàn chỉnh, không tìm thấy `eslint`.
- Đã chạy `npm run build`: chưa chạy được vì thiếu `node_modules/vinext/dist/cli.js`.
- Đã thử `npm ci`, `npm install --ignore-scripts` và `pnpm install`; môi trường Windows trả về lỗi filesystem `ENOTEMPTY` trong quá trình dựng `node_modules`, nên dependency vẫn chưa đủ để xác minh build/lint.
- Đã thử chạy test Node trực tiếp; tiến trình không xuất assertion và phải dừng sau khi treo, vì vậy chưa có kết quả pass/fail đáng tin cậy.

### Kết luận hiện tại

Chưa sửa logic ứng dụng vì chưa có lỗi runtime/test nào tái hiện được. Việc sửa đoán mò lúc này có nguy cơ làm sai nghiệp vụ.

### Việc AI tiếp theo nên làm

1. Xóa hoàn toàn `node_modules` sau khi chắc chắn không còn tiến trình Node/npm/pnpm đang chạy.
2. Cài lại bằng phiên bản Node tương thích với `engines.node` trong `package.json` và dùng đúng một package manager.
3. Chạy lại `npm run lint`, `npm run build`, rồi chạy từng nhóm test với timeout.
4. Ghi từng lỗi tái hiện được theo mẫu: lệnh, input, lỗi đầy đủ, nguyên nhân gốc, file sửa, test hồi quy.

### Lần xử lý tiếp theo

- Đã cài lại dependency bằng pnpm theo `pnpm-lock.yaml`.
- Phát hiện test `ctktkt-export.test.mjs` dùng trực tiếp `jszip` nhưng `package.json` chưa khai báo package này.
- Đã thêm `jszip@^3.10.2` vào `devDependencies` và đồng bộ `package-lock.json`/`pnpm-lock.yaml`.
- Sau khi dependency được dựng lại, test export tiếp tục bị chặn bởi `node_modules` không hoàn chỉnh: `exceljs` thiếu dependency runtime `readable-stream/passthrough`. Đây là lỗi cài đặt/symlink của môi trường hiện tại, không phải assertion của ứng dụng.
- Lần chạy suite trước khi sửa dependency: 343 test pass, 1 test không khởi động vì thiếu `jszip`.

### Thiết kế lại giao diện — 2026-10-12

- Theo skill frontend-design, áp dụng phong cách phòng điều hành: xanh đen, nền giấy sáng, điểm nhấn đồng và xanh ngọc.
- Thêm `app/control-room.css`, nạp sau stylesheet hiện có; đổi nhãn và biểu tượng thương hiệu tại `components/app-shell.tsx`.
- Thiết kế đồng bộ sidebar, header, dashboard tháng, báo cáo kỹ thuật và màn hình đăng nhập; giữ nguyên logic nghiệp vụ và phân quyền.
- Có breakpoint mobile, focus bàn phím, màu cảnh báo đỏ và stylesheet in.
- `git diff --check` đạt. Lint bị treo do dependency/môi trường hiện tại; chưa xác nhận build hay visual QA trong trình duyệt.
- AI tiếp theo: khôi phục dependency sạch, chạy lint/build rồi kiểm tra giao diện đăng nhập, dashboard và báo cáo ở 390px/1440px với phiên đăng nhập hợp lệ.

### Khôi phục môi trường và sửa stylesheet

- Cài sạch bằng `npm ci --ignore-scripts --no-audit --no-fund` thành công (785 package). Các lỗi EPERM trước đây liên quan đến sandbox; chạy kiểm tra với quyền thích hợp.
- Dùng package-lock.json làm lockfile chính; pnpm-lock.yaml phát sinh trong lần điều tra được giữ local, không commit.
- Sửa specificity của focus ô nhập để stylesheet cũ không ghi đè màu xanh ngọc; bảo đảm chữ trong phần tiêu đề báo cáo được in màu đen.
- Thêm `npm test` để AI tiếp theo chạy suite bằng một lệnh trên Windows hoặc Linux.
- Sửa 8 lỗi lint: đổi tên biến `module` trong phân quyền; tách dependency memo sự kiện; lấy snapshot tiến độ đồng bộ trước callback React; cập nhật ref NKVH trong effect; reset xác nhận dừng tổ máy và phiên người dùng khi prop thay đổi.
- `npm run lint`: exit 0, còn 16 warnings (navigation hard reload và biến không dùng trong extension/export). Chưa loại bỏ các hard reload vì đang dùng để bảo vệ dữ liệu chưa lưu/phiên đăng nhập.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `npm run build`: exit 0, đủ 5 giai đoạn client/server/RSC/SSR.
- Test đồng bộ NKVH, khoảng ngày và phân quyền: 12/12 đạt. Kiểm tra cuối bằng `npm test`: 344/344 đạt, 0 fail (28.7 giây), bao gồm test export từng bị thiếu jszip.
- Visual QA trên trình duyệt và luồng dữ liệu production vẫn cần phiên đăng nhập và dữ liệu thật; chưa tuyên bố đã xác minh các luồng này.

### /wb — Thiết kế local chờ người dùng duyệt

- Thay stylesheet đang nạp sang `app/wb-design.css`: sidebar sáng, điểm nhấn xanh lam, KPI phẳng, tiêu đề gọn; tham khảo Shadcn Admin/Tabler trong `wb/README.md`.
- Sửa màu tên/cương vị người dùng để đọc được trên sidebar sáng.
- Thêm `/wb-preview` chỉ trong development, dữ liệu tĩnh minh họa, không truy cập database/API. Production trả notFound từ trang; proxy không mở route này ngoài development.
- Dev server cổng 5173; đã kiểm tra trang đăng nhập và preview ở 1440px/390px. Mobile không tràn toàn trang; bảng có vùng cuộn riêng.
- Lint các file sửa và TypeScript đạt. Không commit/push theo yêu cầu duyệt local trước.
- Build production và toàn suite 344 test đạt sau thay đổi /wb.
- Người dùng đã yêu cầu đẩy GitHub sau khi xem local; xuất bản theme /wb, trang preview development và tài liệu/ảnh tham khảo. Không đưa pnpm-lock.yaml phát sinh trong điều tra vào commit.
