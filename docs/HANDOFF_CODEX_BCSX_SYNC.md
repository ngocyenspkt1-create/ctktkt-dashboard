# Bàn giao cho Codex — Đồng bộ BCSX & Tiện ích QLKT v0.4.21

**Ngày bàn giao:** 18/09/2026  
**Người thực hiện:** Antigravity AI Assistant  
**Đối tượng tiếp nhận:** Codex / Kỹ sư phát triển tiếp theo  
**Phạm vi:** Báo cáo sản xuất ngày (`/bcsx-report`), Tiện ích Chrome QLKT (`v0.4.21`), Xuất Excel BCSX (`/api/bcsx-export`), Khắc phục build TypeScript trên Vercel.

---

## 1. Tóm tắt trạng thái Git & Triển khai

- **Thư mục dự án:** `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`
- **Nhánh:** `main`
- **Remote đẩy web chính thức:** `github` (`https://github.com/ngocyenspkt1-create/ctktkt-dashboard.git`)
- **Commit HEAD hiện tại:** `553310c` (`docs: cap nhat tai lieu ban giao trang thai hien tai docs/HANDOFF_CURRENT.md`)
- **Trạng thái Git:** `working tree clean` (đã commit và push toàn bộ lên `github/main`).
- **Trạng thái Vercel:** Đã build và deploy thành công lên production ([https://ctktkt-dashboard.vercel.app](https://ctktkt-dashboard.vercel.app)). Xác nhận file `qlkt-sync-extension/manifest.json` trên live site đang trả về `"version": "0.4.21"`.

---

## 2. Chi tiết các tính năng đã hoàn thành

### 2.1. Tối ưu Giao diện Bảng 1 — Thông số nửa giờ (`components/bcsx-report.tsx`)
- **Thiết kế 3 Ca song song:**
  - 47 mốc nửa giờ được chia đều theo 3 ca:
    - **Ca 1 (00:30 – 08:00):** 16 mốc (index 0 – 15)
    - **Ca 2 (08:30 – 16:00):** 16 mốc (index 16 – 31)
    - **Ca 3 (16:30 – 23:59):** 15 mốc (index 32 – 46) + 1 dòng đệm
  - Hiển thị trọn vẹn trong chiều cao 1 màn hình (~420px), **hoàn toàn không cần cuộn dọc hay cuộn ngang**.
- **Chế độ xem linh hoạt (Tabs):** Cho phép xem `3 Ca song song (Toàn ngày)`, `Ca 1`, `Ca 2`, `Ca 3`, hoặc `Cuộn dọc (47 mốc)`.
- **Dán thông minh từ Excel (Smart Paste):**
  - Dán trực tiếp trên ô bất kỳ bằng `Ctrl + V` (tự tách tab/enter theo dòng và cột).
  - Nút **"📋 Dán từ Excel"** mở modal trợ giúp, cho phép chọn điểm bắt đầu (Toàn ngày, Ca 2, Ca 3) và dán khối dữ liệu lớn.
- **Điều hướng bàn phím Excel:**
  - `Enter` hoặc `↓`: Xuống ô tiếp theo trong cùng cột.
  - `↑`: Lên ô phía trên.
  - `←` / `→`: Chuyển sang ô bên cạnh.
- **Header tinh gọn & Phím tắt:** Thu gọn tiêu đề cột (`P cực`, `Q cực`, `P bán`, `U áp`), căn phải số liệu font monospace, thanh tiến độ `Đã nhập: X/47 điểm (%)`.
- Phần upload CSV dự phòng được dời xuống cuối trang để ưu tiên không gian cho bảng thông số.

### 2.2. Mục 2: Đồng bộ Số liệu tổng ngày từ "Dữ liệu các tháng"
- **Nút "🔄 Lấy từ Dữ liệu các tháng":**
  - Tự động gọi API `/api/daily-inputs?period=YYYY-MM` theo ngày đang chọn.
  - Trích xuất 4 chỉ tiêu theo bảng mã chuẩn:
    - `B` (S1) / `H` (S2): Sản lượng đầu cực (tự động nhân 1000 quy đổi từ triệu kWh sang MWh).
    - `C` (S1) / `I` (S2): Sản lượng thương phẩm / điểm bán (tự động nhân 1000 quy đổi sang MWh).
    - `AE` (S1) / `AF` (S2): Than tiêu thụ (tấn).
    - `AR`: Than tồn kho toàn nhà máy (tấn).
  - Tự động nạp vào form khi người dùng chuyển ngày hoặc bấm nút nạp thủ công.
  - Khi người dùng bấm **"Lưu số liệu tổng ngày"**, hệ thống tự động lưu ngược về bảng `daily_inputs` (chia 1000 về triệu kWh cho sản lượng) để 2 trang luôn khớp nhau hoàn hảo.

### 2.3. Nâng cấp Tiện ích QLKT lên v0.4.21 (`browser-extension/qlkt-sync` & `public/qlkt-sync-extension`)
- **Hỗ trợ trang QLKT Thời gian/Tình hình vận hành:**
  - URL: `http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/rpt_hour_operation.jsf`
- **`content.js`:**
  - Nhận diện `pageKind = "operation"`.
  - Hàm `extractOperatingEvents()`: Bỏ qua bảng giờ phát máy DH1_MF1/DH1_MF2 ở trên, bóc tách chính xác bảng nhật ký "Tình hình vận hành" ở dưới:
    - `startAt`: Thời điểm bắt đầu (`HH:mm:ss DD/MM/YYYY`)
    - `endAt`: Thời điểm kết thúc
    - `eventType`: Phân loại 1–5
    - `description`: Nội dung sự kiện
  - Hàm `classifyEventUnit()`: Phân loại thông minh:
    - Thuộc **S1**: Chứa các từ khóa `S1`, `TM1`, `TỔ 1`, `LÒ 1`, `MÁY 1`, `DH1_MF1`...
    - Thuộc **S2**: Chứa các từ khóa `S2`, `TM2`, `TỔ 2`, `LÒ 2`, `MÁY 2`, `DH1_MF2`...
    - Sự kiện chung của nhà máy (SPP 220kV, thanh cái...) được gán cho cả hai hoặc phân loại rõ ràng.
- **`background.js`:**
  - Viết hàm `syncBcsxEvents(operatingDate)`: Tự động mở tab QLKT `rpt_hour_operation.jsf`, chọn ngày, gửi message `READ_QLKT_EVENTS`, nhận kết quả và đóng tab tạm.
- **`web-bridge.js`:**
  - Cho phép chạy trên URL `/bcsx-report`, cầu nối hai chiều `SYNC_BCSX_EVENTS` ↔ `SYNC_BCSX_EVENTS_QLKT`.
- **Đóng gói phân phối:**
  - Đã đồng bộ toàn bộ 9 file sang `public/qlkt-sync-extension/`.
  - Đã nén thành `public/qlkt-sync-extension.zip` (27,660 bytes) cho người dùng tải trực tiếp từ web.

### 2.4. Mục 3: Đồng bộ Tình hình vận hành (Nhật ký sự kiện)
- Nút **"⚡ Đồng bộ sự kiện từ QLKT"** trên `/bcsx-report`: Kích hoạt tiện ích đọc dữ liệu từ QLKT và tự động điền danh sách sự kiện vào bảng của tổ máy S1/S2 đang chọn.
- Badge trạng thái tiện ích trực quan: `🟢 Tiện ích v0.4.21 đã kết nối` / `⚠️ Chưa kết nối tiện ích (v0.4.21)`.
- Hỗ trợ thêm dòng, xóa dòng, sửa thủ công và lưu vào API `/api/operating-events`.

### 2.5. Cập nhật Xuất file Excel BCSX (`/api/bcsx-export/route.ts`)
- Bổ sung hàm quy đổi `toMwh(val)` cho sản lượng đầu cực và thương phẩm khi đọc từ `daily_inputs` vào template Excel BCSX (cell C60, C61...) để đảm bảo file xuất ra luôn đúng đơn vị MWh.

### 2.6. Khắc phục sự cố Build Vercel (TypeScript TS5097)
- **Nguyên nhân:** File `lib/auth/initial-users-data.ts` import `./password.ts` và `./session.ts` có đuôi `.ts`, gây lỗi `error TS5097` khi Vercel chạy `next build` với `tsconfig.json` mặc định của Next.js.
- **Giải pháp:** Chuẩn hóa `lib/auth/initial-users-data.ts` thành self-contained:
  - Tự định nghĩa hàm băm mật khẩu `hashPassword` bằng `node:crypto`.
  - Tự định nghĩa union types `Role`, `Permission` và mảng `PERMISSIONS`.
  - Không import bất kỳ file `.ts` nội bộ nào.
- **Kết quả:** `npx tsc --noEmit` đạt **0 lỗi** với `tsconfig.json` nguyên bản. Vercel build và deploy thành công 100%.

---

## 3. Danh sách file thay đổi quan trọng

| Đường dẫn file | Mô tả thay đổi |
|---|---|
| `components/bcsx-report.tsx` | Bố cục 3 Ca song song, Smart Paste, nút nạp Dữ liệu các tháng, nút đồng bộ QLKT, badge tiện ích v0.4.21 |
| `app/api/bcsx-export/route.ts` | Hàm quy đổi `toMwh` đảm bảo cell C60/C61 trong Excel luôn chuẩn đơn vị MWh |
| `browser-extension/qlkt-sync/content.js` | Extractor bảng sự kiện QLKT `rpt_hour_operation.jsf` và bộ phân loại `classifyEventUnit` |
| `browser-extension/qlkt-sync/background.js` | Hàm `syncBcsxEvents` mở tab QLKT, chọn ngày và lấy sự kiện |
| `browser-extension/qlkt-sync/web-bridge.js` | Mở rộng URL `/bcsx-report` và message `SYNC_BCSX_EVENTS` |
| `browser-extension/qlkt-sync/manifest.json` | Nâng version lên `0.4.21` |
| `public/qlkt-sync-extension/*` | Bản phân phối chính thức của tiện ích (9 file) |
| `public/qlkt-sync-extension.zip` | Gói zip nén phân phối trên web |
| `lib/auth/initial-users-data.ts` | Self-contained hash và permissions, sửa triệt để lỗi TS5097 trên Vercel |
| `tests/position-permissions.test.mjs` | Test kiểm tra 25 cương vị và 163 tài khoản nhân sự |
| `tests/qlkt-meter-sync.test.mjs` | Test version `0.4.21` và test trích xuất/phân loại sự kiện QLKT S1/S2 |
| `docs/HANDOFF_CURRENT.md` | Tài liệu bàn giao trạng thái hiện tại cập nhật commit mới nhất |

---

## 4. Kết quả kiểm tra kỹ thuật (Checklist)

| Lệnh kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `node --test tests/*.mjs` | **44/44 test PASSED** | Kiểm tra toàn bộ tính toán PPA, phân bổ kế hoạch năm, đồng bộ tiện ích, phân quyền |
| `npx tsc --noEmit` | **0 lỗi PASSED** | Type checking hoàn toàn sạch |
| `npm run build` | **PASSED** | Biên dịch thành công 20 routes SSR/Client |
| `git status` | **Clean** | Không còn file uncommitted, đồng bộ `github/main` |
| `Vercel production` | **LIVE v0.4.21** | `manifest.json` và `zip` trên live server đã cập nhật |

---

## 5. Lưu ý cho Codex trong các bước tiếp theo

1. **Khi người dùng báo "chưa thấy giao diện mới":**
   - Hướng dẫn người dùng nhấn **`Ctrl + F5`** hoặc **`Ctrl + Shift + R`** trên trình duyệt để xóa cache JS cũ của trang web.
   - Hướng dẫn vào `chrome://extensions` nhấn nút **Reload** ở tiện ích *Đồng bộ chỉ tiêu QLKT*.
2. **Quy tắc làm việc của dự án:**
   - Sau khi hoàn thành hoặc sửa bất kỳ tính năng nào, luôn chạy `node --test tests/*.mjs` và `npx tsc --noEmit`.
   - Luôn đồng bộ giữa thư mục `browser-extension/qlkt-sync` và `public/qlkt-sync-extension` cùng file `zip`.
   - Tự động commit và push lên `github/main` (`git push github main`) để web tự deploy.
3. **Các hạng mục còn tồn đọng trong lộ trình (xem `docs/HANDOFF_CURRENT.md`):**
   - `npm run lint` còn 10 lỗi cảnh báo quy tắc React Hook (`set-state-in-effect` và `ref during render`).
   - Rà soát bảo mật mật khẩu khởi tạo tài khoản trong `lib/auth/initial-users-data.ts`.
   - Phân quyền API chi tiết hơn bằng `requirePermission(...)`.

