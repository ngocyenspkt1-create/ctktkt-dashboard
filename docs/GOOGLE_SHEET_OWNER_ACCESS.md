# Đồng bộ Google Sheet bằng quyền chủ sở hữu

Nút **Đẩy Google Sheet** trên web không đăng nhập Gmail của người đang sử dụng máy. Web gửi dữ liệu tới API máy chủ; API dùng URL Apps Script và mã kết nối lưu trong Secret của Vercel. Apps Script phải được triển khai để chạy bằng quyền của tài khoản chủ sở hữu bảng tính.

## Cấu hình Apps Script một lần

1. Đăng nhập đúng tài khoản chủ sở hữu bảng tính.
2. Mở dự án Apps Script đang dùng cho chức năng đồng bộ DH1.
3. Chọn **Deploy -> Manage deployments -> Edit**.
4. Tại **Execute as**, chọn **Me** và kiểm tra đúng tài khoản chủ sở hữu.
5. Tại **Who has access**, chọn phạm vi cho phép máy chủ Vercel gọi Web App. Nếu có lựa chọn **Anyone**, dùng lựa chọn này; mã kết nối bí mật trong Apps Script vẫn phải được kiểm tra trước mọi thao tác ghi.
6. Chọn **New version -> Deploy** và giữ nguyên URL kết thúc bằng /exec.
7. Trên Vercel, giữ URL trong biến GOOGLE_SHEET_APPS_SCRIPT_URL và mã kết nối trong GOOGLE_SHEET_SYNC_TOKEN. Không đưa hai giá trị này vào mã nguồn, trình duyệt hoặc gửi cho người dùng.

## Phân quyền người dùng

- Trên web CTKTKT, chỉ cấp quyền sync_google_sheet cho những cương vị được phép đẩy dữ liệu.
- Trên Google Sheet, các tài khoản khác có thể chỉ được cấp quyền **Viewer**.
- Khi họ bấm **Đẩy Google Sheet**, thao tác ghi vẫn được Apps Script thực hiện bằng quyền của chủ sở hữu, không phải quyền Gmail của người đang dùng máy.
- Nút **Mở Google Sheet** chỉ mở bảng tính để xem; Google tiếp tục kiểm soát quyền xem của từng tài khoản.

Không lưu mật khẩu Gmail, cookie đăng nhập hoặc mã xác minh hai bước trong website. Nếu tài khoản chủ sở hữu thay đổi, phải triển khai lại Apps Script bằng đúng tài khoản mới.
