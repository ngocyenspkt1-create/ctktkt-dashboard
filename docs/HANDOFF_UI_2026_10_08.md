# Hiệu chỉnh giao diện CTKTKT — 08/10/2026

Phạm vi: chỉ trình bày giao diện. Người dùng đã yêu cầu build, push và xác minh deployment.

## Nguồn thiết kế

- PanJiaChen/vue-element-admin, MIT: https://github.com/PanJiaChen/vue-element-admin
- GitHub API, truy vấn topic:admin-dashboard, sort=stars, order=desc: 90.157 sao;
  AdminLTE 45.640; Tabler 41.831. Thứ hạng chỉ áp dụng cho nhóm truy vấn này.
- Lưu bảng màu gốc và giấy phép ở vendor/vue-element-admin.
- Áp dụng phong cách vào React hiện tại; không thay nền tảng bằng Vue.

## Thay đổi

- app/globals.css: màu chung, thanh điều hướng, thẻ nội dung, bảng báo cáo,
  trạng thái focus/hover, trang đăng nhập, hiển thị khi in.
- components/app-shell.tsx: thương hiệu, thanh tiêu đề, bố cục tài khoản.
- components/app-navigation.tsx: khoảng cách, trạng thái đang chọn, menu điện thoại.
- components/auth-layout.tsx: bố cục và màu trang đăng nhập/đổi mật khẩu.

Không chỉnh app/api, lib, drizzle, public, công thức, quyền, dữ liệu lưu trữ,
thao tác đồng bộ, xuất Excel hoặc gửi mail. Giữ Times New Roman.
Không nhập, lưu, xóa, import hoặc đồng bộ dữ liệu trong kiểm tra trình duyệt.
Các thay đổi có sẵn trước phiên được giữ nguyên.

## Kiểm tra

- ESLint 3 tệp giao diện: đạt.
- TypeScript ứng dụng (cấu hình kiểm tra ở outputs/ui-review/tsconfig.json): đạt.
- TypeScript toàn dự án: lỗi sẵn trong .next/types/validator.ts do routes.js thiếu
  AppRoutes, LayoutRoutes, ParamMap, AppRouteHandlerRoutes. Không sửa tệp tự sinh.
- 13/13 kiểm thử: bảo toàn dữ liệu, phân quyền cương vị, thao tác bảng Excel.
- Kiểm tra trình duyệt localhost:3000: dữ liệu tháng, KTKT, BCSX, nước, hóa chất,
  PPA, PMIS. Phiên đăng nhập sẵn có; chưa kiểm tra đăng nhập mới.
- Menu điện thoại được kiểm tra ở 390 x 844; bảng rộng vẫn cuộn ngang.
- Build phát hành đúng cấu hình Vercel (`next build`): đạt ngày 08/10/2026.
- Kiểm thử liên quan trước phát hành: 19/20 đạt. Kiểm thử `unsaved inputs block
  date switching and page reload warns before losing edits` trong ctktkt-save-display
  thất bại ở regex kiểm tra mã nguồn. Tệp kiểm thử và components/ctktkt-report.tsx
  giống HEAD cb4d9e4, không bị bản giao diện thay đổi. Giữ lỗi có sẵn ngoài phạm vi.
- ESLint ba component giao diện: đạt. Không sửa công thức để xử lý lỗi ngoài phạm vi.
- Trạng thái deployment và kiểm tra production được báo riêng sau push.

## Dung lượng

npm.cmd run storage:check thực hiện thành công (chỉ đọc): 13,2 MiB, 11 bảng,
122.349 dòng. Script so sánh với mức 5 GiB cấu hình sẵn và báo OK;
mức gói thực tế chưa được xác nhận từ dashboard nhà cung cấp.

Chưa có phiên dashboard Turso/Vercel để kiểm tra quota và lượng đọc/ghi/request.
Kiểm tra thủ công: Turso → Organization → Usage; Vercel → Team → Usage.
Chỉ đánh giá ngưỡng 70/85/95% sau khi xác nhận giới hạn gói thực tế.
