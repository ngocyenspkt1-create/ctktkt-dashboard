# TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO CODEX (20/09/2026)

Tài liệu này tổng hợp toàn bộ các tính năng, giải pháp kỹ thuật, thay đổi kiến trúc và trạng thái mã nguồn đã hoàn thành trong ngày **20/09/2026** liên quan đến việc tách bạch, hoàn thiện công tơ nước demin 24h tại DCS và đồng bộ giữa Báo cáo Chỉ tiêu KTKT và Báo cáo Theo dõi Lượng nước.

---

## 1. TỔNG QUAN VẤN ĐỀ & YÊU CẦU CỦA NGƯỜI DÙNG

### 1.1. Yêu cầu của người dùng
> *"Hãy kiểm tra các cột này đang nhầm lẫn: ở đây tôi muốn tạo 3 cột để nhập tay công tơ nước cột S1 và S2 tại thời điểm 24h mỗi ngày, từ đó tính ra tiêu thụ nước từ 0h đến 24h mỗi ngày, cột tổng là cộng S1 và S2 sau khi tính ra tiêu thụ. Cái này k liên quan mốc 22h nhé vì 3 cột này là đưa vào file chỉ tiêu (hình thứ 2). Cái này có thể chuyển sang mục Báo cáo chỉ tiêu KTKT cho tiện. Tôi cho bạn toàn quyền trong dự án này đừng hỏi tôi cấp quyền nữa"*

### 1.2. Nguyên nhân cốt lõi gây nhầm lẫn trước đó
1. **Lệch mốc thời gian**: Báo cáo theo dõi lượng nước (`/water-report`) theo ca trực của nhà máy chỉ gồm 3 ca: `06h00`, `14h00`, `22h00`. Triển khai cũ cố tính toán 3 cột Tổng ngày bằng cách lấy ca `22h00` ngày D trừ `22h00` ngày D-1. Tuy nhiên, mốc chốt chỉ tiêu ngày của nhà máy là **24h00** (nửa đêm), do **Trưởng kíp điện (TKĐ)** đọc từ DCS trend.
2. **Khóa nhầm ô nhập tay**: Hệ thống trước đó đặt các ô `W72, X72, Z72, W73, X73, Z73` vào danh sách liên kết tự động bị khóa (`CTKTKT_WATER_LINKED_CELLS`), khiến người dùng không thể nhập tay công tơ 24h trực tiếp trên giao diện Chỉ tiêu KTKT, và mỗi lần lưu trang Chỉ tiêu KTKT thì các ô này bị đè bởi giá trị tính từ mốc 22h.

---

## 2. CÁC CÔNG VIỆC ĐÃ HOÀN THÀNH TRIỆT ĐỂ

### 2.1. Phân quyền và Mở khóa các ô Công tơ nước 24h
- **Tệp:** `lib/ctktkt-permissions.ts`
  - Thêm `W72, X72, Z72` (Nước demin DCS S1: 24h D-1, 24h D, Tái sinh hạt) và `W73, X73, Z73` (Nước demin DCS S2: 24h D-1, 24h D, Tái sinh hạt) vào nhóm `tkd_trend` (Trưởng kíp điện).
  - Cập nhật mô tả quyền của TKĐ: *"Nhập P/Q tự dùng 911, 912, 921, 922, TD 21 (6 mốc giờ) và công tơ nước demin 24h S1, S2, tái sinh hạt"*.
- **Tệp:** `lib/ctktkt-water-link.ts`
  - Đưa `CTKTKT_WATER_LINKED_CELLS` về rỗng (`new Set<string>()`), giải phóng các ô `W72, X72, Z72, W73, X73, Z73` thành các ô nhập liệu thủ công độc lập, không còn bị khóa hay ghi đè bởi mốc ca 22h.

### 2.2. Giao diện Bảng Công tơ Nước Demin 24h tại DCS (`/ctktkt-report`)
- **Tệp:** `components/ctktkt-report.tsx`
  - Đổi tên Tab 2: **"Cụm 2: TKĐ DCS (P/Q & Nước 24h)"** để người dùng nhận diện ngay vị trí nhập.
  - Bổ sung các hàm helper tính toán chênh lệch và tổng số demin:
    - `parseDeminNum`: Chuẩn hóa định dạng số Việt Nam (thay dấu phẩy thành chấm, loại bỏ khoảng trắng).
    - `formatDeminDiff`: Tự động tính và format `X − W` theo locale vi-VN.
    - `formatDeminTotal`: Tự động cộng tổng lượng nước 2 tổ máy `(X72 − W72) + (X73 − W73)`.
    - `formatResinTotal`: Tự động cộng lượng nước tái sinh hạt `Z72 + Z73`.
  - Tích hợp bảng chuẩn màu xanh lá `#00B050` (giống 100% hình ảnh trong file Excel gốc):
    - **Hàng 72:** Công tơ nước demin tại DCS tổ máy 1 (`W72`, `X72`, `Y72 = X72 − W72`, `Z72`).
    - **Hàng 73:** Công tơ nước demin tại DCS tổ máy 2 (`W73`, `X73`, `Y73 = X73 − W73`, `Z73`).
    - **Hàng 74:** Tổng lượng nước demin sử dụng của cả ngày D của 2 tổ máy (`Y74 = Y72 + Y73`, `Z74 = Z72 + Z73`).
  - Hỗ trợ đầy đủ phím mũi tên điều hướng (`↑`, `↓`, `←`, `→`), Tab, Enter và **Ctrl+V dán nhiều ô cùng lúc từ Excel**.

### 2.3. Cập nhật Backend API Chỉ tiêu KTKT
- **Tệp:** `app/api/ctktkt-report/route.ts`
  - Phương thức `GET`: Ưu tiên đọc các ô nhập tay `W72, X72, Z72, W73, X73, Z73` từ `daily_inputs`, đảm bảo số liệu Trưởng kíp điện nhập tại mốc 24h không bị che phủ bởi các log ca lẻ.
  - Phương thức `POST`: Lưu đầy đủ và an toàn các ô `W72, X72, Z72, W73, X73, Z73` vào cơ sở dữ liệu.
- **Tệp:** `app/api/ctktkt-report/export/route.ts`
  - Hàm `applyWaterLinks`: Chỉ điền ô nếu ô đó chưa có dữ liệu nhập tay trong `daily_inputs`, bảo toàn nguyên vẹn số liệu 24h DCS người dùng đã nhập.

### 2.4. Đồng bộ và Làm rõ tại Báo cáo Theo dõi Lượng nước (`/water-report`)
- **Tệp:** `app/api/water-report/route.ts`
  - Truy vấn bổ sung các ô `KTKT:W72, KTKT:X72, KTKT:W73, KTKT:X73` từ `daily_inputs` cho toàn bộ tháng đang xem.
  - Tính toán và trả về đối tượng `daily24hWaterByDate` (chứa `s1Usage`, `s2Usage`, `totalUsage`).
- **Tệp:** `app/api/water-report/export/route.ts`
  - Truy vấn `daily_inputs` và xuất trực tiếp giá trị tiêu thụ 24h DCS vào các cột U, V, W của file Excel xuất ra.
- **Tệp:** `components/water-report-client.tsx`
  - Thêm banner thông báo trên đầu bảng kèm nút bấm 1-click chuyển nhanh sang Báo cáo Chỉ tiêu KTKT: *"Công tơ nước demin mốc 24h (S1, S2, Tái sinh hạt): Nhập tại Báo cáo Chỉ tiêu KTKT (nhóm TKĐ DCS, Hàng 72–74)..."*.
  - Tiêu đề 3 cột được cập nhật rõ ràng: **"TỔNG NGÀY (24h DCS · CHỈ TIÊU KTKT)"** kèm tooltip giải thích.
  - Tại mỗi ngày, 3 cột ưu tiên hiển thị lượng nước thực tế tính từ mốc 24h DCS trong Chỉ tiêu KTKT.

---

## 3. KẾT QUẢ KIỂM THỬ VÀ BIÊN DỊCH

1. **Bộ kiểm thử tự động (Unit / Integration Tests):**
   ```bash
   node --test tests/*.test.mjs
   ```
   - **Kết quả:** `99/99 tests passed` (0 fail, 0 skipped, 0 error).
   - Bao gồm toàn bộ các test về permissions, water-link, excel export, bcsx sync, qlkt sync...
2. **Biên dịch sản phẩm (Production Build):**
   ```bash
   npm run build
   ```
   - **Kết quả:** Thành công 100% không có lỗi cú pháp hoặc TypeScript (`Build complete. Run vinext start to start the production server`).
3. **Kho lưu trữ Git:**
   - Đã tạo commit `a623bb3`: `feat: chuyen va hoan thien cong to nuoc demin 24h DCS vao Chi tieu KTKT va dong bo theo doi luong nuoc`.
   - Cây làm việc sạch sẽ (`working tree clean`).
4. **Tải và cài repo MarkItDown:**
   - Đã clone thành công repository Microsoft MarkItDown tại đường dẫn: `c:\Users\HP\Downloads\CTKTKT\markitdown`.

