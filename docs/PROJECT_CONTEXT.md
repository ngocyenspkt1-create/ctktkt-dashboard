# Hồ sơ tổng hợp dự án CTKTKT Dashboard

> **Mục đích:** Đây là tài liệu đọc đầu tiên khi tiếp tục dự án. Nội dung tổng hợp trạng thái mã nguồn thực tế đến ngày **21/09/2026**, thay cho việc phải đọc lại toàn bộ các file bàn giao theo ngày.
>
> **Mốc mã nguồn đã rà soát:** `00240d93ac73061574295c2dfc5c5ca14835910b` trên nhánh `main`; tại thời điểm lập tài liệu, `HEAD == github/main`.
>
> **Nguyên tắc ưu tiên:** mã nguồn và workbook gốc là bằng chứng chính. Những ghi chú cũ nói công tơ nước ngày lấy từ mốc `22h00` đã bị thay thế bởi quy tắc công tơ DCS **24h** mô tả tại mục 5.4.

## 1. Mục tiêu của hệ thống

Ứng dụng phục vụ Phân xưởng Vận hành 1, Nhà máy Nhiệt điện Duyên Hải 1, nhằm:

- Nhập, lưu, tính và theo dõi các chỉ tiêu kinh tế kỹ thuật theo ngày/tháng.
- Tự động lấy dữ liệu được phép từ QLKT, PMIS và các file CSV/Excel.
- So sánh suất hao nhiệt thực tế với PPA cho S1, S2 và toàn nhà máy.
- Lập và xuất báo cáo BCSX A0/S1/S2 đúng mẫu.
- Nhập và xuất file Chỉ tiêu KTKT theo đúng workbook gốc.
- Theo dõi lượng nước theo ca.
- Đẩy dữ liệu đã hoàn thiện lên Google Sheet báo cáo hằng ngày.
- Quản lý tài khoản và phân quyền theo Cương vị vận hành.

## 2. Vị trí, kho mã nguồn và kiến trúc

| Hạng mục | Giá trị hiện tại |
| --- | --- |
| Thư mục dự án | `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard` |
| Nhánh chính | `main` |
| GitHub chính thức | `https://github.com/ngocyenspkt1-create/ctktkt-dashboard.git` (remote `github`) |
| Web production | `https://ctktkt-dashboard.vercel.app` |
| Giao diện | React 19, Next.js 16/Vinext, TypeScript, Tailwind CSS |
| API | Route handlers trong `app/api` |
| Cơ sở dữ liệu | Turso/libSQL qua `@libsql/client/http` |
| Xác thực | Cookie JWT, khóa `AUTH_SECRET` từ biến môi trường |
| Triển khai | Vercel |
| Tiện ích QLKT | Chrome/Edge Manifest V3, phiên bản `0.4.28` |

Biến môi trường quan trọng: `AUTH_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Không ghi token, mật khẩu hoặc URL Apps Script có mã bí mật vào Git.

## 3. Các trang và chức năng đã hoàn thành

### 3.1. Trang tổng quan và chỉ tiêu tháng `/`

- Nhập trực tiếp dữ liệu cho 7 chỉ tiêu KTKT theo tháng.
- Máy chủ tự tính kết quả, so sánh định mức và lưu lịch sử phiên bản.
- Có dữ liệu vận hành theo ngày, ghi chú và cảnh báo CE/CF; cảnh báo chỉ hiển thị, không chặn lưu.
- Có mô phỏng kế hoạch đạt chỉ tiêu năm và phân bổ phần còn lại theo sản lượng dự kiến.
- Kiểm tra đầu vào ở phía máy chủ; không tin kết quả tính sẵn do trình duyệt gửi lên.

### 3.2. So sánh suất hao nhiệt PPA và thực tế `/ppa-heat-rate`

- Đồng bộ 4 công tơ PPA và đủ 48 chu kỳ nửa giờ từ QLKT.
- Có phương án dự phòng bằng chọn/dán CSV; hỗ trợ định dạng CSV QLKT đầy đủ và dạng compact theo mã file.
- Tính PPA, thực tế và chênh lệch cho S1, S2, NMNĐ; giữ độ chính xác nguồn, chỉ làm tròn khi hiển thị.
- Có bảng lịch sử, biểu đồ, Standard Line và xuất workbook Excel.
- Nhập/sửa nhận xét S1, S2 theo ngày; có thể nhập lại nhận xét lịch sử từ Google Sheet.
- Có Công suất khả dụng riêng S1/S2; thiếu một trong hai thì không cho đẩy Google Sheet.
- Nút `Đẩy Google Sheet · dd/mm/yyyy` thực hiện một lượt. Máy chủ chỉ báo thành công khi Apps Script trả `status: ok` đúng hàng của ngày cần ghi.
- Cấu hình Apps Script URL và mã kết nối được giữ ngoài Git; không nhập mật khẩu Google vào ứng dụng.

### 3.3. Báo cáo PMIS `/pmis-report`

- Theo dõi 5 chỉ tiêu cho S1 và S2 theo ngày.
- Đồng bộ từ QLKT cho một ngày hoặc khoảng ngày, tối đa 62 ngày/lượt.
- Bảng dữ liệu và hai biểu đồ S1/S2 đặt cạnh nhau; mỗi chỉ tiêu có miền trục Y riêng.
- Phần PMIS trong Chỉ tiêu KTKT nhận sản lượng S1/S2 tại `J157:K158` và hàng 02-PĐ Duyên Hải 1 tại `C181:T181`.

### 3.4. Báo cáo sản xuất BCSX `/bcsx-report`

- Mục 1 có đủ 48 mốc nửa giờ, gồm `00:30` đến `23:30` và dòng `23:59`.
- Hiển thị ba ca song song; hỗ trợ dán từ Excel, Enter và phím mũi tên.
- Một nút đồng bộ QLKT lấy dữ liệu tổng ngày và nhật ký sự kiện cho cả S1/S2, chỉ lưu khi toàn bộ gói đúng ngày và đủ trường.
- Sự kiện được phép kết thúc sau nửa đêm của ngày kế tiếp.
- Có thể nạp lịch sử Mục 1 trực tiếp từ đúng hai file Excel S1 và S2; đã kiểm tra gói 19 ngày với 7.296/7.296 giá trị hợp lệ. Luồng có sao lưu, đọc lại và hoàn nguyên khi lỗi.
- Xuất đúng ba mẫu `BCSX_NMD_A0`, `BCSX_NMD_S1`, `BCSX_NMD_S2`, giữ merge, style, khổ in, header/footer và bố cục template.
- Quy tắc A0: P/Q/P điểm bán cộng S1+S2; riêng `Utc 220 kV` lấy nguyên từ S1; than tồn kho không cộng đôi.
- Mục 2 BCSX lấy từ Chỉ tiêu KTKT để tránh nhập trùng; Mục 3 là nhật ký sự kiện QLKT hoặc nhập bổ sung.

### 3.5. Báo cáo Chỉ tiêu KTKT `/ctktkt-report`

- Dựng lại quy trình nhập và xuất từ workbook Chỉ tiêu KTKT gốc; không suy diễn công thức theo nhãn giao diện.
- Giao diện chia theo cụm/cương vị; ô không có quyền bị khóa ở cả giao diện và API chuyên biệt của báo cáo.
- Hỗ trợ dán vùng nhiều hàng/nhiều cột từ Excel/Google Sheets, số Việt Nam, bỏ cột nhãn, bỏ qua ô khóa/tự tính mà không làm lệch dữ liệu.
- Điều hướng bằng `← → ↑ ↓`, Tab/Shift+Tab, Enter/Shift+Enter.
- Có chế độ nhập lịch sử Excel và đối chiếu công thức; đã dùng dữ liệu ngày 01–19/09/2026 để kiểm tra.
- Liên kết 42 ô Mục 1 BCSX vào sáu mốc `06, 10, 14, 18, 22, 24h`.
- `Utc 220 kV` tại `M20:R20` chỉ lấy từ S1.
- Có mẫu email hằng ngày Times New Roman, trích xuất hơn 22 chỉ số, sao chép HTML hoặc text.
- Có ghi chú hiệu chỉnh cân than riêng S1/S2, lưu tối đa 500 ký tự và gắn comment vào các ô Excel `W/Y/AA28` hoặc `AG/AI/AK28`.
- Nhãn ca đã chuẩn hóa: **08h = Ca 1, 16h = Ca 2, 24h = Ca 3**.
- Xuất lại workbook tháng, giữ các sheet, công thức, merge, style và thiết lập in của mẫu.

### 3.6. Theo dõi lượng nước `/water-report`

- Bảng chuẩn 20 cột theo các ca `06h00`, `14h00`, `22h00`.
- Hỗ trợ nhập, upload file tháng, so sánh/diagnostic với Excel, tính chuỗi chênh lệch và tỷ lệ, xuất Excel.
- Có xử lý công tơ quay vòng 25.000 cho chuỗi số liệu ca theo quy tắc đã kiểm chứng từ workbook nguồn.
- Phân quyền nhập theo cương vị và quyền quản lý trang `edit_water`.
- Ba cột tổng ngày S1/S2/Tổng từng được đặt tại đây nhưng **đã xóa**. Công tơ nước ngày dùng cho Chỉ tiêu KTKT phải nhập tại mốc 24h trên `/ctktkt-report`, không lấy từ mốc 22h.
- Lượng nước tái sinh hạt vẫn có thể được liên kết từ Theo dõi lượng nước sang `Z72/Z73` của Chỉ tiêu KTKT; nếu người dùng đã nhập tay thì giữ giá trị nhập tay.

### 3.7. Quản lý tài khoản `/admin/users`

- Quản lý người dùng: thêm, sửa, khóa/mở khóa, đổi mật khẩu, xóa.
- Có 25 Cương vị và 10 quyền: `manage_users`, `edit_monthly_kpi`, `edit_daily_inputs`, `edit_ppa`, `edit_pmis`, `edit_bcsx`, `edit_water`, `sync_qlkt`, `sync_google_sheet`, `view_all`.
- Ma trận quyền theo Cương vị; có tìm kiếm/lọc người dùng.
- Người dùng cần đăng nhập lại sau khi quyền thay đổi để JWT nhận quyền mới.

## 4. Tiện ích đồng bộ QLKT v0.4.23

- Hai cây nguồn bắt buộc đồng nhất: `browser-extension/qlkt-sync` và `public/qlkt-sync-extension`.
- Gói cài đặt: `public/qlkt-sync-extension.zip`.
- Tiện ích tái sử dụng tab QLKT đúng URL, chờ DOM dùng được, đặt đúng ngày bằng native input setter và bấm đúng nút cập nhật.
- Đọc bảng ảo hóa/ExtSheet cho công tơ PPA, số liệu sản xuất, PMIS/02-PĐ và nhật ký sự kiện.
- Web chỉ nhận gói đúng ngày, đủ mã bắt buộc và đủ dữ liệu S1/S2; lỗi một nguồn thì không ghi dở dang.

## 5. Các công thức và quyết định nghiệp vụ đã xác nhận

### 5.1. Dầu

- Tiêu thụ đúng theo Excel: `ΔF1 − ΔF2`, không phải `F1 − F2` cùng thời điểm.
- Kỳ 06h lấy mốc 24h ngày D−1; các kỳ sau trừ mốc trước trong ngày.

### 5.2. Than, độ ẩm và nhiệt trị

- Than tiêu thụ là chênh tổng 12 cân theo ba ca, cộng ô hiệu chỉnh tương ứng.
- Hiệu chỉnh nằm riêng tại `W/Y/AA28` cho S1 và `AG/AI/AK28` cho S2, không được cộng hai lần.
- Tỷ lệ Sub-bitum: `AL87:AL92`; độ ẩm Sub-bitum: `AO87:AO92`.
- Quy ẩm theo cơ sở 8,5% và chuỗi công thức `AM:AR` của workbook.
- S1/S2 dùng nhiệt trị ngày chung của nhà máy theo `AS86/AT86/AT87`, rồi tính SHN tại `AV87/AV88`.

### 5.3. Hơi và NH3

- Hơi là chỉ số lũy kế, tiêu thụ từng kỳ bằng chênh mốc hiện tại với mốc trước.
- NH3: tổng tồn ba bồn; `tồn 0h + nhập − tồn 24h`, sau đó chia sản lượng theo đúng mẫu.

### 5.4. Công tơ nước demin 24h cho Chỉ tiêu KTKT

Đây là quy tắc hiện hành và thay thế toàn bộ cách làm cũ dùng mốc 22h:

- Trưởng kíp điện nhập chỉ số công tơ DCS tại **24h ngày D** cho S1 và S2 tại `/ctktkt-report`.
- S1: `Y72 = X72 − W72 + WATER_ADJ_S1`.
- S2: `Y73 = X73 − W73 + WATER_ADJ_S2`.
- Tổng sử dụng: `Y74 = Y72 + Y73`.
- Tái sinh hạt: `Z74 = Z72 + Z73`.
- `W72/W73` là chỉ số 24h D−1; giao diện kế thừa `X72/X73` của ngày trước nhưng vẫn cho phép nhập/chỉnh theo quyền.
- Khi công tơ chạm 25.000 m³ rồi reset về 0, giao diện phát hiện `X < W`, cho nút bù `+25.000`; phải ghi lý do hiệu chỉnh. Công thức xuất Excel và báo cáo email cũng dùng số hiệu chỉnh này.
- Các ô W/X/Z và trường hiệu chỉnh thuộc nhóm quyền `tkd_trend`.
- Trang Theo dõi lượng nước không còn ba cột 24h này; mốc `22h00` của báo cáo ca là luồng khác.

## 6. Luồng Google Sheet

- Nguồn đẩy là tab so sánh PPA/thực tế sau khi đã có đủ PPA, dữ liệu thực tế, nhận xét và Công suất khả dụng S1/S2.
- Payload gồm S1, S2 và NMNĐ; Công suất khả dụng chỉ có S1/S2.
- Nút một lần nhấn; không còn hộp xác nhận lần hai.
- Máy chủ kiểm tra URL Apps Script, mã kết nối, ngày, hàng đích và phản hồi `status: ok` đúng hàng.
- Dữ liệu lịch sử ở cột đánh giá có thể nhập về web, sau đó web là nguồn để đẩy lại Sheet.
- Không tự ý bấm ghi dữ liệu báo cáo thật trong lượt phát triển nếu không có phiên đăng nhập và ngày nghiệm thu do người dùng kiểm soát.

## 7. Nguồn dữ liệu và nguồn sự thật

| Nhóm dữ liệu | Nguồn ưu tiên |
| --- | --- |
| Công tơ PPA 48 chu kỳ | QLKT; CSV là dự phòng |
| Sản lượng/PMIS/02-PĐ | QLKT qua tiện ích |
| BCSX Mục 1 | Nhập tay/dán Excel hoặc nạp đúng hai file lịch sử S1/S2 |
| BCSX Mục 2 | Chỉ tiêu KTKT đã lưu |
| BCSX Mục 3 | Nhật ký sự kiện QLKT + nhập bổ sung |
| Chỉ tiêu KTKT | Nhập tay có phân quyền + liên kết BCSX/QLKT đã xác nhận |
| Nước theo ca | `/water-report`, mốc 06h/14h/22h |
| Nước demin ngày | `/ctktkt-report`, công tơ DCS 24h D và D−1 |
| Nước tái sinh hạt | `/water-report` liên kết sang Z72/Z73, có thể nhập tay ưu tiên |
| Google Sheet | Nơi hiển thị/nhận báo cáo; web là nguồn dữ liệu sau khi nhập đủ |

Không chọn im lặng một nguồn khi hai nguồn mâu thuẫn. Phải hiển thị cảnh báo hoặc chặn xuất cho đến khi xác định được nguồn đúng.

## 8. Kiểm thử và bằng chứng hiện tại

- Ngày 21/09/2026 đã chạy tuần tự:

  ```powershell
  node --max-old-space-size=1024 --test --test-concurrency=1 tests/*.test.mjs
  ```

- Kết quả: **105/105 test đạt**, 0 fail, 0 skipped.
- Bộ test bao phủ KPI tháng/năm, PPA, QLKT/CSV, Google Sheet, PMIS, BCSX import/export, CTKTKT công thức/export, phân quyền, công tơ nước 24h/hiệu chỉnh, nước theo ca và giữ cấu trúc workbook.
- Các bản phát hành gần nhất trước tài liệu này đã vượt qua TypeScript và build production; khi thay đổi mã phải chạy lại, không lấy kết quả cũ làm bằng chứng cho mã mới.
- Test ExcelJS nặng nên dùng `--test-concurrency=1` để tránh hết bộ nhớ.

## 9. Rủi ro và việc còn phải xử lý

### P0 — Bảo mật tài khoản

- `lib/auth/initial-users-data.ts` còn chứa mật khẩu khởi tạo dạng rõ và nhiều tài khoản dùng chung mật khẩu mặc định.
- Cần xóa mật khẩu rõ khỏi Git, cấp mật khẩu tạm riêng, buộc đổi lần đầu và đổi các mật khẩu từng xuất hiện trong repository.
- Danh sách nhân sự chứa dữ liệu nội bộ; không sao chép ra ngoài phạm vi được phép.

### P0 — Phân quyền API dùng guard chung

- Một số API như `daily-inputs`, `measurements`, `ppa-heat-rate` và `ppa-heat-rate/notes` vẫn dùng `requireEditor()` thay vì quyền riêng của từng chức năng.
- Cần thay bằng `requirePermission(...)` phù hợp và thêm test 401/403 cho từng quyền.

### P1 — Nghiệm thu dữ liệu thật

- Cần nghiệm thu có kiểm soát với phiên QLKT thật, Vercel và Turso cho từng luồng quan trọng.
- Cần đối chiếu thêm một ngày khác 17/09 có than Sub-bitum và hiệu chỉnh cân than.
- Cần thử công tơ nước 24h cho hai ngày liên tiếp, trường hợp bình thường và reset 25.000, rồi đối chiếu `W72:Z74` trong file xuất.
- Cần thử bấm Google Sheet một lần trên ngày đã đủ dữ liệu và đối chiếu đúng hàng `DH1`.
- Cần nghiệm thu nạp thật 7.296 giá trị BCSX lịch sử bằng tài khoản được phép; bộ đọc đã kiểm tra nhưng lượt ghi production không được tự động thực hiện.

### P1 — Vận hành hệ thống

- Chưa có bằng chứng hoàn chỉnh về audit log người sửa, sao lưu/khôi phục, rollback, giám sát lỗi và kiểm thử bảo mật độc lập.
- Cần xác nhận lại số nhân sự chính thức; tài liệu cũ ghi 124 trong khi dữ liệu khởi tạo hiện có nhiều hơn.

## 10. Quy trình bắt buộc khi tiếp tục phát triển

1. Đọc file này trước.
2. Chạy `git status --short --branch`; không ghi đè thay đổi không thuộc nhiệm vụ.
3. Đọc file nguồn và workbook thật liên quan; không dựa riêng vào nhãn UI hoặc bàn giao cũ.
4. Giữ một nguồn sự thật cho dữ liệu trùng nhau; trường liên kết phải khóa hoặc nêu rõ nguồn.
5. Không chạy seed/migration hoặc ghi dữ liệu production nếu chưa được phép rõ ràng.
6. Chạy kiểm thử mục tiêu, toàn bộ test tuần tự, TypeScript và build theo mức rủi ro.
7. Cập nhật mục `Nhật ký mới nhất` bên dưới trước khi dừng; ghi rõ đã làm, còn dở, bước tiếp theo.
8. Commit phần ổn định với message rõ ràng; kiểm tra đúng remote `github` trước khi push.

Các lệnh kiểm tra chuẩn:

```powershell
git -c safe.directory=C:/Users/HP/Downloads/CTKTKT/ctktkt-dashboard status --short --branch
node --max-old-space-size=1024 --test --test-concurrency=1 tests/*.test.mjs
npx.cmd tsc --noEmit --pretty false
node --max-old-space-size=768 scripts/run-framework.mjs build --prerender-concurrency 1
git -c safe.directory=C:/Users/HP/Downloads/CTKTKT/ctktkt-dashboard diff --check
```

## 11. Các file cần biết

| Phạm vi | File/thư mục chính |
| --- | --- |
| Giao diện CTKTKT | `components/ctktkt-report.tsx` |
| Công thức CTKTKT | `lib/ctktkt-report.ts` |
| Trường/metadata bổ sung | `lib/ctktkt-extra-fields.ts` |
| Phân quyền CTKTKT | `lib/ctktkt-permissions.ts` |
| Liên kết BCSX → CTKTKT | `lib/ctktkt-bcsx-link.ts` |
| Liên kết nước tái sinh | `lib/ctktkt-water-link.ts` |
| API CTKTKT | `app/api/ctktkt-report/` |
| PPA | `components/ppa-heat-rate-*.tsx`, `lib/ppa-heat-rate.ts`, `app/api/ppa-heat-rate/` |
| Google Sheet | `lib/google-sheet-sync.ts`, `app/api/google-sheet-sync/route.ts` |
| BCSX | `components/bcsx-report.tsx`, `lib/bcsx-*.ts`, `app/api/bcsx-*/` |
| Nước theo ca | `components/water-report-client.tsx`, `lib/water-report/`, `app/api/water-report/` |
| PMIS | `components/pmis-report.tsx` và bộ đọc tiện ích QLKT |
| Tài khoản/quyền | `lib/auth/`, `app/api/admin/`, `app/admin/users/` |
| Tiện ích QLKT | `browser-extension/qlkt-sync/`, `public/qlkt-sync-extension/` |
| Nghiệm thu chi tiết cũ | `docs/ACCEPTANCE.md`, `docs/HANDOFF_*.md` |

## 12. Nhật ký mới nhất

### 21/09/2026 — D-1, xác minh lưu NH3 và chống PMIS đọc nhầm ngày

- Đã thống nhất ngày mặc định D-1 theo múi giờ Việt Nam cho Chỉ tiêu KTKT, BCSX, So sánh PPA, Báo cáo PMIS, ngày đẩy Google Sheet và ngày gợi ý khi thêm bản ghi Nước.
- Đã sửa luồng lưu Chỉ tiêu KTKT: chỉ gửi những ô tài khoản hiện tại được quyền sửa; sau khi ghi phải đọc lại CSDL và so sánh từng ô mới báo thành công. Cụm NH3 (`N69:P73`) vì vậy không còn trường hợp giao diện báo lưu nhưng tải lại mất mà không cảnh báo.
- Đã nâng tiện ích QLKT lên `0.4.24`: nếu vừa đổi ngày tại màn hình Sản lượng hoặc 02-PĐ, bộ đọc chờ bảng PrimeFaces nạp xong thay vì đọc ngay số liệu ngày cũ; nếu ngày đã đúng thì không bấm làm mới thừa.
- Đã đồng bộ hai cây tiện ích và đóng gói lại `public/qlkt-sync-extension.zip`.
- Kiểm tra mục tiêu đạt; TypeScript đạt; build production đạt. Toàn bộ test được chạy lại trước khi phát hành. ESLint các component vẫn báo các khoản nợ React-hook/unused đã tồn tại từ trước và được ghi nhận, không phải lỗi build.
- Còn cần nghiệm thu thật: tải/cài lại tiện ích `0.4.24`, chọn một ngày có số liệu đã biết, đồng bộ PMIS & 02-PĐ rồi đối chiếu QLKT; nhập NH3, lưu, Ctrl+F5 và xác nhận các ô còn nguyên.
- Bước tiếp theo: nếu QLKT của một màn hình tải lâu hơn ngưỡng hiện tại, chụp màn hình/ngày cụ thể để bổ sung tín hiệu hoàn tất AJAX thay cho tăng thời gian chờ cố định.

### 21/09/2026 — Tạo hồ sơ tổng hợp

- Đã tổng hợp kiến trúc, chức năng, công thức, nguồn dữ liệu, tích hợp, kiểm thử, rủi ro và quy trình tiếp tục vào một file duy nhất.
- Đã xác nhận trạng thái hiện hành của nước demin: nhập công tơ DCS 24h tại Chỉ tiêu KTKT; không dùng mốc 22h của báo cáo ca; hỗ trợ hiệu chỉnh reset 25.000 m³; ba cột 24h đã bị xóa khỏi trang Theo dõi lượng nước.
- Đã chạy lại toàn bộ test: 105/105 đạt.
- Còn dở: các hạng mục bảo mật/phân quyền API và nghiệm thu production liệt kê tại mục 9.
- Bước tiếp theo khuyến nghị: nghiệm thu công tơ nước 24h trên hai ngày liên tiếp và đối chiếu file xuất trước, sau đó xử lý hai rủi ro P0.

### 21/09/2026 — Một nút đồng bộ QLKT

- Đã gom quy trình đồng bộ hằng ngày về nút **Đồng bộ toàn bộ QLKT** tại trang Dữ liệu các tháng.
- Một lần bấm đọc và tự lưu: dữ liệu ngày, PPA, PMIS cân bằng nhiệt, nhật ký BCSX S1/S2 và PMIS/02-PĐ; mọi gói phải đúng cùng ngày trước khi bắt đầu ghi.
- Các trang đích không còn nút đồng bộ riêng theo ngày. Công cụ PMIS nhiều ngày vẫn còn để phục vụ nạp lịch sử.
- Tiện ích hiện hành là `0.4.25`; popup chỉ mở trang đồng bộ tập trung. Hai cây tiện ích và file ZIP phải tiếp tục được cập nhật cùng nhau.
- Đã kiểm tra 108/108 test, TypeScript và build production. Còn cần nghiệm thu end-to-end bằng tài khoản QLKT thật và tiện ích `0.4.26` sau triển khai.

### 21/09/2026 — Sửa dropdown tổ máy Cân bằng nhiệt

- Tiện ích `0.4.26` không còn dừng ngay khi PrimeFaces không phản ánh tổ máy qua `selectedIndex`; nhận diện thêm nhãn widget và chủ động đọc MF1 → MF2 khi trạng thái ban đầu mơ hồ.
- Còn cần nghiệm thu thực tế bằng nút tổng hợp. Đây là phần phụ thuộc DOM/AJAX của QLKT nên kiểm thử mô phỏng và build không thay thế được lần chạy thật.

### Cập nhật nhập liệu và lịch sử 21/09/2026

- Mọi ô dữ liệu số/văn bản dùng chung thao tác kiểu Excel: paste ma trận và di chuyển bằng phím mũi tên/Enter/Tab; các loại input điều khiển, tìm kiếm và ô khóa bị loại trừ.
- Chỉ tiêu KTKT nhập lịch sử trực tiếp từ `.xls/.xlsx` bằng một nút. Hệ thống chỉ ghi ô nhập tay sau khi kết quả tự tính của web khớp 100% với các ô công thức Excel được kiểm tra; sai lệch được báo đến ngày/chỉ tiêu/ô/giá trị.
- File gốc 19/09/2026 đã đạt 1.634/1.634 kiểm tra, nhưng chưa ghi production. Luồng cũ nạp mẫu 16–17/09 đã bỏ khỏi UI, API và hành vi tự seed.

### 21/09/2026 — Than 6A10, PMIS, đồng bộ riêng và nguồn NH3

- Bảng than Chỉ tiêu KTKT chỉ còn 6A10 theo ba ca của S1/S2; dữ liệu Sub-bitum cũ không còn quyền nhập, hiển thị hoặc tham gia tính.
- Công suất đặt PMIS mặc định `1245 MW`; bộ đọc số Việt Nam được dùng trước khi tính để tránh mất Tổng tự dùng.
- Quyết định đồng bộ tập trung đã được thay thế theo yêu cầu vận hành: Dữ liệu các tháng, PPA, BCSX, PMIS và Chỉ tiêu KTKT có nút đồng bộ riêng theo thời điểm cần dùng.
- File Chỉ tiêu là nguồn gốc cho các trường NH3 có đối tượng tương ứng: `BN` (dùng theo mức bồn) và `CN` (nhập trong ngày) được liên kết sang Dữ liệu các tháng và khóa nhập tay. Không suy diễn `BQ/BR` vì đây là NH3 DCS riêng S1/S2, không có trường nguồn tương ứng trong file Chỉ tiêu.
- Trạng thái kiểm tra: 112/112 test đạt; TypeScript và build production đạt. Chưa commit/push/deploy; chưa có số liệu Turso production vì thiếu biến môi trường kết nối trong phiên hiện tại.
