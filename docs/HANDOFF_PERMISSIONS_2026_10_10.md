# Phân quyền CTKTKT — 10/10/2026

## Phạm vi
- Chỉ sửa phân quyền; giữ công thức, dữ liệu báo cáo, quy tắc ngày D/D-1 và xuất file.
- Không đưa các tệp chưa theo dõi hoặc thay đổi có sẵn trong HANDOFF_CODEX_2026_09_20.md vào release.

## Cấu hình
- Catalog: lib/auth/session.ts và lib/auth/permission-modules.ts; admin/users có 11 cột chức năng.
- KTKT: edit_ctktkt toàn mục hoặc 13 quyền ctktkt_<group>. P73 luôn liên kết và không nhập tay.
- Nước: edit_water toàn mục hoặc 4 quyền water_<group>. Xóa ca: admin hoặc trưởng ca/supervisor có edit_water toàn mục.
- Hóa chất: edit_chemical toàn mục hoặc 5 quyền chemical_<code>; xóa vẫn chỉ admin.
- Số liệu ngày: edit_daily_inputs; DA..DH cần edit_pmis. QLKT cần sync_qlkt cộng quyền của dữ liệu nhận; G-Sheet không cấp quyền sửa PPA.
- Admin hoặc manage_users có toàn quyền. Tài khoản đăng nhập vẫn được xem báo cáo như trước.

## Lưu và cập nhật quyền
- permissions_version=1: chuyển một lần từ phạm vi cương vị cũ sang quyền chi tiết, không mở rộng sang nhóm khác.
- permissions_version=2: lấy nguyên cấu hình đã lưu, kể cả []; không tái cấp theo vai trò/cương vị.
- lib/auth/current-user.ts đọc lại trạng thái/role/quyền từ DB mỗi yêu cầu máy chủ. Cookie cũ không giữ quyền ghi đã thu hồi.
- /api/auth/session làm mới cookie và context khi quay lại cửa sổ hoặc mỗi 60 giây. Proxy vẫn kiểm tra token; trang/API admin kiểm tra quyền hiện hành.
- PUT /api/admin/positions dùng batch nguyên khối, kiểm tra giá trị, giữ ít nhất 1 quản trị đang hoạt động.
- Sao lưu 25 cấu hình: C:/Users/HP/AppData/Local/Temp/ctktkt-permissions-backup-3ffe0a0c-42aa-44be-82b0-c2dc3d908c30.json.

## Kiểm tra
- 339/339 tests đạt; regression mới tests/permission-enforcement.test.mjs dùng dữ liệu giả và SQLite bộ nhớ.
- Next production build đạt; kiểm thử giao diện bằng tài khoản người dùng thật chưa thực hiện.
- storage:check OK: 13.53 MiB, 0.2642% so với mốc tham chiếu miễn phí 5 GiB. Không có quyền đọc usage quản lý Turso/Vercel; xem Turso > Database > Usage và Vercel > Usage.
- Release remote: github/main (không dùng origin). Kiểm tra Vercel theo đúng SHA sau push; HTTP/login không phải bằng chứng thao tác sau đăng nhập.
