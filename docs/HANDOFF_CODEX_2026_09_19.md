# TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO CODEX (19/09/2026)

Tài liệu này tổng hợp toàn bộ các tính năng, thay đổi kiến trúc, quy tắc nghiệp vụ và trạng thái mã nguồn đã hoàn thành trong ngày **19/09/2026** để Codex tiếp quản và phát triển tiếp mà không bị gián đoạn hay trùng lặp.

---

## 1. TỔNG QUAN CÁC YÊU CẦU ĐÃ HOÀN THÀNH

Trong ngày 19/09/2026, các yêu cầu sau của người dùng đã được thực hiện và kiểm thử đầy đủ:

1. **Phân quyền nhập liệu và tái cấu trúc giao diện Chỉ tiêu KTKT (`/ctktkt-report`)**:
   - Phân quyền theo 7 cương vị vận hành của Phân xưởng Vận hành 1 (PXVH1).
   - Tổ chức lại trang Chỉ tiêu KTKT thành các cụm/tab nghiệp vụ gọn gàng.
   - Kiểm tra quyền chặt chẽ ở backend (`/api/ctktkt-report`).
2. **Nạp dữ liệu mẫu 2 ngày liên tiếp (16 & 17/09/2026)**:
   - Module seed mẫu và nút nạp trực tiếp trên giao diện để tính toán chênh lệch công tơ, KPI và xuất file Excel kiểm tra.
3. **Bỏ toàn bộ hộp thoại xác nhận `window.confirm`**:
   - Loại bỏ các popup hỏi lại gây phiền hà người dùng ("Tôi đã cho quyền rồi, đừng hỏi nữa").
4. **Mẫu báo cáo email hàng ngày kèm file chỉ tiêu**:
   - Modal tạo báo cáo hàng ngày định dạng bảng chuẩn, font chữ **Times New Roman** giống ảnh mẫu.
   - Tự động trích xuất hơn 22 chỉ số KPI từ file chỉ tiêu KTKT ngày đang xem.
   - Nút copy 1-click dạng HTML (giữ nguyên định dạng khi paste vào Outlook/Gmail) và dạng Text.
5. **Hỗ trợ sao chép / dán nhiều ô (Multi-cell Copy/Paste) & Điều hướng bàn phím**:
   - Người dùng có thể copy một vùng nhiều ô từ Excel rồi dán trực tiếp vào bảng web (tự động phân bổ theo hàng và cột).
   - Điều hướng bàn phím linh hoạt bằng các phím mũi tên `↑`, `↓`, `←`, `→`, `Tab`, `Enter`.
6. **Đồng bộ PMIS Sản lượng & 02-PĐ "Duyên Hải 1" từ QLKT**:
   - Bảng Sản lượng PMIS: Lấy `J157, K157, L157` (S1) và `J158, K158, L158` (S2) từ màn hình `rpt_a_production_day.jsf`.
   - Bảng 02-PĐ: Đồng bộ 18 chỉ tiêu tương ứng từ hàng **"Duyên Hải 1"** trên màn hình QLKT `rpt_CT_QLKT_02_PD_New.jsf` vào các ô `C181:T181`.
   - Nâng cấp extension Chrome `qlkt-sync-extension` (v0.4.23).
7. **Bỏ đồng bộ Mục 2 trong BCSX từ QLKT & Liên kết trực tiếp Mục 2 BCSX từ Chỉ tiêu KTKT**:
   - Mục 2 của Báo cáo sản xuất (S1, S2, A0) lấy trực tiếp từ file Chỉ tiêu KTKT ngày đó (đầu cực, thương phẩm, than tiêu thụ, than tồn kho).
   - Bỏ đồng bộ Mục 2 này từ QLKT để tránh trùng lặp số liệu. Nút đồng bộ QLKT của BCSX chuyển thành chỉ đồng bộ Mục 3 (Nhật ký sự kiện).
   - Thêm nút "🔄 Nạp lại từ Chỉ tiêu KTKT" tại Mục 2 BCSX và tự động đồng bộ 2 chiều khi chỉnh sửa.

---

## 2. CHI TIẾT KỸ THUẬT VÀ CÁC TỆP ĐÃ SỬA ĐỔI

### 2.1. Phân quyền & Quản lý ô Chỉ tiêu KTKT
- **Tệp:** `lib/ctktkt-permissions.ts`
  - Định nghĩa 7 nhóm quyền: `tkd_dcs`, `power_meters`, `oil_meters`, `coal_meters`, `steam_flow`, `nh3_tank`, `pmis_reports`.
  - Phân quyền cho:
    - `Trưởng kíp điện`: `tkd_dcs`, `steam_flow`, `nh3_tank`, `coal_blend_pmis`, `pmis_reports`, `td21`.
    - `Trực phụ điện`, `Trực chính Điện`: `power_meters`, `td21`.
    - `Lò phó`: `oil_meters`, `startup_shutdown`.
    - `Máy nghiền`: `coal_meters`.
    - `Vận hành viên NH3 - Lò hơi phụ`: `nh3_tank`.
    - `Trưởng ca`, `Admin`, `Quản đốc`: Toàn quyền xem và chỉnh sửa.
  - Thêm các ô mới vào danh sách quyền:
    - Sản lượng PMIS: `J157`, `K157`, `J158`, `K158`.
    - PMIS 02-PĐ: `C181` đến `T181`.
- **Tệp:** `app/api/ctktkt-report/route.ts`
  - Kiểm tra `canEditCell(userPosition, cell)` trước khi ghi. Từ chối lưu các ô không thuộc quyền của vị trí đó.

### 2.2. Giao diện Chỉ tiêu KTKT (`components/ctktkt-report.tsx`)
- Tái cấu trúc thành 6 Tab:
  1. **Tổng hợp KPI**: Chỉ mở nhập ô ẩm than `I35`, `I36`. Các chỉ số KPI (suất hao than, suất hao nhiệt, tỷ lệ tự dùng...) tự động tính toán.
  2. **TKD Trend DCS**: 8 cột tham chiếu từ BCSX và lưu lượng hơi.
  3. **Công tơ S1 & S2**: Công tơ điện 24h ngày D và ngày D-1, đồng hồ dầu F1-F2, 12 cân than theo 3 ca.
  4. **Hơi, NH3, TD21 & Than trộn**: Lưu lượng hơi, bồn NH3, công tơ TD21, than trộn PMIS.
  5. **Khởi động / Ngừng tổ máy**: Accordion thu gọn tiện lợi.
  6. **PMIS & 02-PĐ**:
     - Bảng 1 (dòng 155-158): Sản lượng điện PMIS (S1, S2, Toàn NM: Phát, Điểm bán, Tự dùng).
     - Bảng 2 (dòng 178-181): 18 chỉ tiêu 02-PĐ tương ứng hàng "Duyên Hải 1" QLKT (`C181:T181`).
     - Tích hợp nút **"⚡ Đồng bộ PMIS & 02-PĐ từ QLKT"**.
- Tích hợp **Multi-cell Paste** (`handleTablePaste`) và **Arrow-key navigation** (`handleKeyDown`) trên toàn bộ các bảng nhập liệu.
- Tích hợp modal xuất báo cáo email qua nút **"📧 Báo cáo Email"**.

### 2.3. Báo cáo Email hàng ngày (`lib/ctktkt-email-report.ts` & `components/ctktkt-email-modal.tsx`)
- Trích xuất tự động hơn 22 chỉ số từ dữ liệu KTKT:
  - Điện đầu cực, điện xuất tuyến, điện tự dùng, tỷ lệ tự dùng (S1, S2, Toàn NM).
  - Than tiêu thụ ngày, độ ẩm than, than quy ẩm 8.5%, suất hao than thô/tinh.
  - Suất hao nhiệt tinh, nhiệt trị làm việc than HHV.
  - Dầu FO tiêu thụ, nước bổ sung tiêu thụ.
  - Than tồn kho, than nhập trong ngày, số giờ phát vận hành.
- Xuất dạng bảng HTML style Times New Roman chuẩn font, đường viền đen thanh mảnh, độ rộng cố định, kèm nút copy clipboard 1 chạm.

### 2.4. Tiện ích mở rộng Chrome (`browser-extension/qlkt-sync/` & `public/qlkt-sync-extension/`)
- Phiên bản: `0.4.23`
- `background.js`:
  - Thêm URL: `DEFAULT_PMIS_02PD_URL = "http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/report/rpt_CT_QLKT_02_PD_New.jsf"`.
  - Thêm handler `SYNC_PMIS_02PD_QLKT` điều hướng mở trang 02-PĐ và lấy số liệu.
- `content.js`:
  - Thêm hàm `extractPmis02PdPayload(operatingDate, tablesOrDoc, productionTablesOrDoc)`.
  - Tìm chính xác hàng có text `"Duyên Hải 1"` (loại trừ `"Duyên Hải 3"` và `"Tổng cộng"`).
  - Ánh xạ 18 cột sang `C181..T181`. Riêng `T181` (Độ phát thải) giữ chuỗi text ("Đạt").
  - Đọc hàng `DH1_MF1` và `DH1_MF2` sang `J157, K157` và `J158, K158`.
  - Thêm `normalizeQlktNumber(raw)` bảo toàn chính xác định dạng số thập phân.
- `web-bridge.js`:
  - Bổ sung `/ctktkt-report` vào danh sách trang được phép giao tiếp.
  - Cầu nối message `SYNC_PMIS_02PD` <-> `SYNC_PMIS_02PD_QLKT`.
- Đã đồng bộ hoàn toàn giữa `browser-extension/qlkt-sync/` và `public/qlkt-sync-extension/`, nén sẵn vào `public/qlkt-sync-extension.zip`.

### 2.5. Báo cáo sản xuất (`components/bcsx-report.tsx` & `app/api/bcsx-*`)
- **Nguyên lý mới**: Bỏ đồng bộ Mục 2 từ QLKT để tránh trùng lặp số liệu.
  - `dauCuc` = `KTKT:J157` (hoặc `J158`) fallback `B * 1000` (hoặc `H * 1000`).
  - `thuongPham` = `KTKT:K157` (hoặc `K158`) fallback `C * 1000` (hoặc `I * 1000`).
  - `thanTieuThu` = `KTKT:N169` (hoặc `N171`) fallback `AE` (hoặc `AF`).
  - `thanTonKho` = `KTKT:I38` fallback `AR`.
- Thêm nút "🔄 Nạp lại từ Chỉ tiêu KTKT" tại Mục 2.
- Nút đồng bộ trên header đổi thành "⚡ Đồng bộ nhật ký sự kiện từ QLKT" (chỉ gửi `SYNC_BCSX_EVENTS` để lấy sự kiện Mục 3).
- `app/api/bcsx-sync/route.ts`: Cho phép `entries` rỗng khi chỉ cập nhật `events`.
- `app/api/bcsx-export/route.ts`: Ưu tiên đọc số liệu từ các ô `KTKT:J157/K157/J158/K158` khi xuất Excel mẫu BCSX S1, S2, A0.

---

## 3. DANH SÁCH COMMITS TRONG NGÀY (CHỦ YẾU)

1. `6681823`: `feat(ctktkt): dong bo PMIS san luong va 02-PD Duyen Hai 1 tu QLKT, lien ket muc 2 BCSX tu CTKTKT`
2. `81dba48`: `fix(ctktkt): cho phep build module bao cao email tren Vercel`
3. `3329988`: `feat(ctktkt): ho tro dan copy-paste nhieu o tu Excel va dieu huong bang phim mui ten Enter Tab`
4. `df528be`: `feat(ctktkt): them mau bao cao gui mail hang ngay phong cach Times New Roman kem file chi tieu`
5. `2a1b77e`: `fix(ctktkt): bo hop thoai xac nhan window.confirm tren giao dien va toi uu module seed`
6. `5fe3244`: `feat(ctktkt): nap du lieu mau 2 ngay 16 va 17-09, tinh toan KPI va ho tro xuat Excel kiem tra`
7. `043b773`: `feat(ctktkt): tai cau truc giao dien theo cum van hanh va phan quyen nhap theo cuong vi`

---

## 4. KẾT QUẢ KIỂM THỬ VÀ BUILD

1. **Bộ kiểm thử tự động (Unit Tests)**:
   - Chạy lệnh: `node --test tests/*.test.mjs`
   - Kết quả: **78 / 78 tests PASS (100%)**
   - Đã bao gồm các bài test trọng yếu:
     - `tests/ctktkt-bcsx-link.test.mjs`: Test trích xuất hàng "Duyên Hải 1" 02-PĐ và sản lượng PMIS.
     - `tests/qlkt-meter-sync.test.mjs`: Test đồng bộ BCSX chỉ lấy sự kiện, Mục 2 lấy từ KTKT, tính toàn vẹn gói extension.
     - `tests/ctktkt-email-report.test.mjs`: Test trích xuất 22 chỉ số và tạo báo cáo email HTML/Text.
     - `tests/ctktkt-permissions.test.mjs`: Test phân quyền chi tiết từng chức danh.
     - `tests/ctktkt-sample-data.test.mjs`: Test dữ liệu mẫu 2 ngày 16 và 17/09.
     - `tests/ctktkt-export.test.mjs`: Test bảo toàn 35 sheet, công thức, định dạng file Excel.
2. **Biên dịch dự án (Build)**:
   - Chạy lệnh: `npm run build`
   - Kết quả: **Thành công 100% (code 0)** trên môi trường Vinext / Vite 8 / Next.js.
3. **Trạng thái Git**:
   - Working tree hoàn toàn sạch (`working tree clean`).
   - Sẵn sàng push lên remote `origin/main`.

---

## 5. CÁC ĐIỀU CẦN LƯU Ý KHI TIẾP TỤC PHÁT TRIỂN

1. **Không hỏi lại quyền người dùng**:
   - Người dùng đã nêu rõ: *"Tôi đã cho quyền rồi, đừng hỏi nữa"*.
   - Mọi thao tác fix lỗi, refactor, chạy test, build và commit cần thực hiện tự chủ, dứt khoát.
2. **Duy trì tính đồng bộ của Chrome Extension**:
   - Khi chỉnh sửa bất kỳ tệp nào trong `browser-extension/qlkt-sync/`, **BẮT BUỘC** phải copy đè sang `public/qlkt-sync-extension/` và nén lại vào `public/qlkt-sync-extension.zip` để test 1 trong `tests/qlkt-meter-sync.test.mjs` luôn vượt qua.
3. **Bảo tồn độ chính xác số liệu**:
   - Các số liệu từ QLKT và CTKTKT không được tự ý làm tròn giữa chừng (`String(Number(...))` hay `toFixed`) trong các hàm tính toán lõi; chỉ làm tròn hiển thị trên UI khi cần thiết.
4. **Liên kết BCSX - CTKTKT**:
   - Mục 1 BCSX -> 42 ô M3:R20 trong CTKTKT.
   - Bảng sản lượng PMIS CTKTKT (`J157, K157, J158, K158`) -> Mục 2 BCSX (`dauCuc`, `thuongPham`).
   - Hai chiều liên kết này đã hoạt động trơn tru và nhất quán.
