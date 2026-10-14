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

### Tối ưu preview local khi người dùng báo giật

- Người dùng xác nhận ngay cả `/wb-preview` tĩnh về nội dung cũng chậm. Log Vite ghi nhận tải trang 955ms và HMR; HTML trước sửa khoảng 141KB gồm runtime/RSC, còn phải tải CSS và JS framework.
- Thêm `npm run preview:design` để tạo cache HTML/CSS đã dựng sẵn; middleware Vite chỉ phục vụ route preview khi development, không áp dụng cho API/trang nghiệp vụ. Cache gitignored, cập nhật bằng lệnh trên sau mỗi lần sửa giao diện; `?live=1` dùng kiểm tra đối chứng.
- Cache có gzip 44.708 bytes; DOM xác nhận 0 script, 0 external stylesheet. Không hydration/HMR trên preview. Đây là tối ưu preview local, không phải kết luận về hiệu năng dữ liệu production.
- Chuyển SpreadsheetInputBehavior từ RootLayout sang AppShell, tránh nạp bộ xử lý bảng ở preview/login. Bỏ backdrop blur header và các lớp blur trang đăng nhập để giảm công việc vẽ.
- Đo HTTP 5 lần mỗi chế độ trên cùng máy: live [1014.5,184.6,147.0,183.3,136.3]ms; static [16.4,11.3,11.2,11.5,11.7]ms. Trung vị 183.3 → 11.5ms. Đây là thời gian phản hồi HTTP, không phải FPS hoặc INP.
- TypeScript, lint file sửa, build production và suite 346 test đạt (thêm 2 test strip runtime/escape CSS). Trực quan preview còn đủ nội dung; ảnh `wb/performance-preview.png`.
- Bản sửa hiện local, chưa push. Cần người dùng thử lại cuộn trên máy; chưa đo FPS thực tế hay nghiệp vụ production.

### Thiết kế lại cụm PPA S1/S2/toàn nhà máy

- Theo ảnh người dùng, thay cụm 3 biểu đồ hai trục bằng `PpaUnitCard`: KPI có đơn vị và định nghĩa TB ngày, chênh lệch có dấu, nhãn vượt/đạt riêng, biểu đồ SHN và chênh lệch tách riêng.
- Giữ nguyên summaryFor/compareHeatRate, dữ liệu và xuất Excel. Không đổi phép tính trung bình hiện hành; hiển thị rõ đây là trung bình cộng của các ngày đủ cặp số liệu, không phải bình quân gia quyền.
- SVG thuần, không animation/ResizeObserver và không import Recharts trong dashboard PPA. Mỗi điểm có title số liệu, có bảng mở rộng; giá trị null ngắt đường, zero được giữ nguyên, trục chênh lệch bao gồm 0.
- Preview sử dụng cùng component tại `/wb-preview#ppa-design`, dữ liệu minh họa; summary lấy từ chính các điểm minh họa.
- Đã kiểm tra desktop 1440px, mobile 390px không tràn trang; ảnh `wb/ppa-redesign.png`. Lint/TypeScript đạt, build đạt trước sửa nhỏ tick nhãn và dữ liệu preview; suite 348 test đạt sau sửa cuối.
- Chưa commit/push; để người dùng duyệt local. Không kết luận tốc độ production từ việc đổi biểu đồ.

### Thiết kế lại khu biểu đồ PMIS

- Theo ảnh người dùng, thay 5 đường khác đơn vị/trục Y ẩn trong mỗi tổ máy bằng 5 biểu đồ nhỏ có nhãn, đơn vị và giá trị gần nhất kèm ngày. Giữ hai cột S1/S2 trên desktop, một cột mobile.
- `PmisTrendPanels` sử dụng cùng domain cho cùng chỉ tiêu của cả S1/S2, tính từ dữ liệu thật, giữ giá trị zero/âm và biên độ NH3 nhỏ. Thay thang PG cố định 400–625 bằng domain chung có đệm để không cắt số liệu nằm ngoài khoảng.
- Thiếu dữ liệu ngắt đường; không còn connectNulls. Giữ nguyên kho dữ liệu, công thức, bộ lọc, đồng bộ và bảng chi tiết. SVG không animation/Recharts; điểm có title số liệu.
- Toolbar ngày được sắp lại với tiêu đề, hướng dẫn và số ngày riêng.
- Preview `/wb-preview#pmis-design` cùng component, dữ liệu minh họa. Ảnh `wb/pmis-redesign.png`; desktop 1440px và mobile 390px đã kiểm tra, không tràn toàn trang.
- Lint/TypeScript đạt; build production đạt; suite 350 test đạt, gồm 2 test domain NH3/âm/zero/null mới. Chưa commit/push.

### Bảng PPA gọn và màu chênh lệch

- Theo yêu cầu người dùng, bỏ 3 cột TT trong bảng web; còn 17 cột (ngày, 14 số liệu, 2 nhận xét), colspan nhóm 4/5/5 và dòng tháng 17.
- CL kJ/kWh và CL % tô đỏ khi compareHeatRate trả Vượt PPA, xanh khi Đạt (bao gồm CL=0), thiếu dữ liệu màu xám. Có chú giải và title trạng thái.
- Bỏ min-width 2600px, dùng bảng 100% với min-width 1000px, tỷ lệ cột và chữ 11px; ngày dd/MM, năm ở nhóm tháng và tooltip ngày đầy đủ. Nhận xét vẫn mở rộng/được sửa theo quyền hiện có.
- Preview desktop 1440px: table 1124.7px nằm trong container 1125px, đủ 17 cột. Màn hình nhỏ vẫn cuộn riêng bảng; chưa đổi format xuất Excel hoặc API.
- Lint component, TypeScript, build production và 350 test đạt; ảnh `wb/ppa-table-compact.png`. Người dùng đã duyệt và yêu cầu đẩy GitHub.

### Khung nhận xét khi rê chuột

- Thay nội dung details ở ô nhận xét PPA bằng PpaNotePreview: hover/focus/chạm mở bảng nổi với đầy đủ nhận xét S1/S2 và ngày. Giữ các nút chỉnh sửa theo quyền hiện có.
- Popover portal tránh bị cắt bởi overflow bảng; desktop ưu tiên bên trái, màn hình dưới 768px ưu tiên phía trên; có nút đóng, Escape, giới hạn chiều cao và cuộn nội dung dài.
- Khi test live preview, phát hiện hydration mismatch do SVG title gồm nhiều text node. Đã đổi title trong PPA/PMIS sang một chuỗi duy nhất; preview sau reload mở popup bình thường.
- Đã kiểm tra bằng trình duyệt: mở bằng click, đủ hai nhận xét nhiều dòng, popup không tràn viewport 566px, đóng được. Hover có handler open/close và đệm 180ms để chuyển chuột vào popup.
- Lint/TypeScript đạt; ảnh `wb/ppa-note-hover.png`. Preview tương tác cần `?live=1#ppa-notes-design` vì preview tĩnh không nạp JavaScript.
- Bản sửa đang local, chưa commit/push.

### Thu gọn tiêu đề và toolbar PPA

- Bỏ khối tiêu đề gradient lớn ở khu thao tác PPA, dùng tiêu đề 21px, mô tả ngắn và hàng Google Sheet riêng.
- Ngày Google Sheet, các nút đẩy/mở/nhập/cài đặt cùng hàng, nút xuất Excel ở cuối. Compact GoogleSheetSyncButton bỏ ngày lặp trong nhãn nút, giữ ngày trong title và giữ chức năng/phân quyền.
- Bộ lọc từ/đến, Áp dụng, preset 15 ngày/Tất cả và số ngày bố trí cùng hàng; preset có aria-pressed. Mobile xuống hàng theo nhóm, chiều cao nút 36px.
- Lint/TypeScript đạt, build đạt; 12 test Google Sheet đạt. Preview minh họa `/wb-preview#ppa-toolbar-design`, ảnh `wb/ppa-toolbar-compact.png`.
- Chưa commit/push; không thực hiện đẩy Google Sheet thật trong quá trình thử giao diện.
- Người dùng đã duyệt và yêu cầu đẩy GitHub: xuất bản nhận xét nổi, toolbar PPA gọn và sửa SVG hydration cùng ảnh minh họa. Các ghi chú local phía trên phản ánh thời điểm trước lần xuất bản này.
- Người dùng yêu cầu đẩy GitHub: xuất bản tối ưu preview và các thiết kế PPA/PMIS cùng test, tài liệu và ảnh. Các ghi chú “chưa push” phía trên là trạng thái tại thời điểm triển khai; lần xuất bản này bao gồm cả ba phần. Cache `.sites-runtime` và pnpm-lock.yaml điều tra không được đưa vào commit.
# 2026-10-12 — Gom biểu đồ PPA (local, chưa đẩy GitHub)

> Cập nhật xuất bản: người dùng yêu cầu đẩy cả biểu đồ và bản sửa Claude lên `origin/main`. TypeScript và toàn bộ test chạy lại thành công; pnpm-lock.yaml không được đưa vào commit. Các nhãn “chưa đẩy” dưới đây ghi lại trạng thái lúc sửa.

- Mỗi thẻ S1/S2/toàn nhà máy dùng một biểu đồ kết hợp đường SHN thực tế/PPA và cột CL đỏ (vượt), xanh (đạt), thay cho hai biểu đồ tách rời.
- SHN theo trục trái, CL theo trục phải; ghi rõ hai trục co độc lập để tránh hiểu nhầm. Giữ nguyên công thức, giá trị 0, khoảng trống thiếu dữ liệu và bảng số liệu mở rộng.
- Giảm khoảng cách phần KPI, tiêu đề, chú giải và số ngày. Không thêm thư viện hay hiệu ứng chuyển động.
- Kiểm tra ESLint component thành công; cập nhật cache `/wb-preview` bằng `npm run preview:design`.


# 2026-10-12 — Claude rà soát toàn dự án (local, chưa đẩy GitHub)

## Kết quả kiểm tra trước khi sửa
- `npx tsc --noEmit`: sạch. `npm run build`: thành công. `node --test tests/*.test.mjs`: 350/350 đạt.
- `npm run lint`: 0 lỗi, 16 cảnh báo (đa số cố ý: hàm tiêm vào trang của tiện ích, tham số `_isDaySheet` giữ chữ ký, `window.location.assign` để tải lại cứng sau đăng nhập/đăng xuất).
- Lưu ý: chạy test phải dùng `node --test tests/*.test.mjs` (lệnh `node --test tests/` báo lỗi giả vì coi thư mục là file).

## Lỗi đã sửa
1. **Bảo mật — các API GET không kiểm tra lại tài khoản trong CSDL.** `proxy.ts` chỉ xác minh chữ ký JWT (hạn 30 ngày), nên tài khoản đã bị **khóa/xóa** vẫn đọc và xuất được toàn bộ số liệu bằng cookie cũ cho tới khi hết hạn (các POST thì đã kiểm tra lại qua `loadCurrentUser`).
   - Thêm `requireSession()` vào `lib/auth/server.ts` (dùng `getSessionUser()` → đọc lại trạng thái tài khoản, chặn cả tài khoản đang bắt buộc đổi mật khẩu).
   - Gắn ở dòng đầu hàm `GET` của: `ppa-heat-rate`, `daily-inputs`, `measurements`, `shift-readings`, `operating-events`, `ctktkt-report`, `ctktkt-report/export`, `water-report`, `water-report/leaders`, `water-report/compare`, `water-report/export`, `bcsx-export`.
   - Thêm test hồi quy trong `tests/auth-security.test.mjs` bảo đảm các GET này luôn có guard.
2. **Cảnh báo ESLint giả trong tiện ích QLKT sync**: chú thích `/* global not found */` bị ESLint hiểu là chỉ thị khai báo biến toàn cục `not`, `found`. Đổi lời chú thích trong `browser-extension/qlkt-sync/background.js` và bản sao `public/qlkt-sync-extension/background.js` (chỉ đổi comment, không đổi hành vi; không cần đóng gói lại `.zip`/tăng phiên bản).

Sau khi sửa: tsc sạch, lint 0 lỗi/12 cảnh báo, test 351/351 đạt.

## Phát hiện chưa sửa (cần người dùng quyết định)
- **Nhiệt trị trước chỉnh (CX)** chỉ bị ẩn ở giao diện (`components/daily-production-table.tsx`, `canViewPreAdjustmentHeatRate`), nhưng `GET /api/daily-inputs` vẫn trả CX cho mọi tài khoản, và AP/AQ (tính từ CX) cũng để lộ giá trị. Nếu CX thật sự cần bảo mật theo cương vị, phải lọc ở server và tính AP/AQ ở server.
- `clientIp()` (`lib/auth/login-throttle.ts`) tin phần tử đầu `x-forwarded-for`; trên hạ tầng không ghi đè header này, kẻ tấn công có thể né giới hạn theo IP (giới hạn theo tên đăng nhập vẫn hoạt động).
- `proxy.ts` chặn `/admin` dựa trên quyền trong JWT (có thể cũ); route handler/trang vẫn kiểm tra lại bằng CSDL nên không thành lỗ hổng, chỉ là quyền mới cấp phải đăng nhập lại mới vào được `/admin`.

## Hướng dẫn đẩy GitHub (cho GPT/Codex)
- Commit các file: `lib/auth/server.ts`, 12 file `app/api/**/route.ts` nêu trên, `tests/auth-security.test.mjs`, 2 file `background.js`, `docs/AI-FIX-LOG.md`.
- Thay đổi `components/ppa-unit-card.{tsx,css}` là phần “Gom biểu đồ PPA” có từ trước, không thuộc lần rà soát này — commit riêng nếu người dùng muốn.
- Không commit `pnpm-lock.yaml` (dự án dùng `package-lock.json`).
- Kiểm tra lại trước khi push: `npx tsc --noEmit`, `npm run lint`, `node --test tests/*.test.mjs`.
# 2026-10-12 — Bảng PPA ngày mới nhất trước (local)

- Bảng chi tiết hiển thị tháng mới nhất trước, các ngày trong tháng giảm dần. Ngày mới nhất là dòng dữ liệu đầu tiên.
- Chỉ đổi thứ tự hiển thị bảng; giữ nguyên thứ tự biểu đồ và file Excel, không thay đổi dữ liệu gốc.
- Kiểm tra TypeScript thành công. Người dùng đã yêu cầu xuất bản thay đổi này lên GitHub.

# 2026-10-12 — Hiệu ứng menu bên theo web theo dõi độ rung (local, chưa đẩy GitHub)

Người dùng yêu cầu: «Tạo hiệu ứng menu cho web giống như tôi đã làm bên web theo dõi độ rung» (nguồn: `nav-fx.js` + khối CSS «Sidebar UI v2» trong `ui.css` của dự án VibraControl).

- `components/app-navigation.tsx` (`NavList`, dùng chung cho thanh bên máy tính và menu điện thoại):
  - Thanh sáng (`.app-nav-glow` nền mờ + `.app-nav-glow-bar` vạch phát sáng bên trái) trượt mượt tới mục đang rê chuột/focus; rời menu thì trượt về mục đang mở; đổi trang thì trượt tới mục mới. Lần đặt đầu tiên không có chuyển động.
  - Tiêu đề nhóm thành nút thu/mở (`aria-expanded`, `aria-controls`, mũi tên xoay). Chiều cao trượt mượt bằng `grid-template-rows 1fr↔0fr`; nhóm thu được đặt `inert` để không Tab vào. Khi mở, các mục hiện lần lượt (trễ 45 ms/mục).
  - Nhóm đã thu được nhớ trong `localStorage` (`qlkt-nav-collapsed`, có try/catch); nhóm chứa trang đang mở luôn mở khi vào trang. Máy chủ luôn render mọi nhóm mở để không lệch hydrate.
- `app/interface.css`: khối «Hiệu ứng menu bên» theo màu thanh bên hiện có (#409eff). Tắt chuyển động khi hệ điều hành bật «giảm chuyển động».
- `app/wb-preview/page.tsx`: thanh bên bản xem trước dùng `SidebarNav` thật để duyệt hiệu ứng tại `/wb-preview?live=1` (chỉ môi trường dev).
- Đã kiểm tra trên `/wb-preview`: thanh sáng di chuyển theo mục, thu/mở nhóm đúng chiều cao, lưu trạng thái, không lỗi console. tsc sạch, lint 0 lỗi, test 351/351.
- Khi đẩy GitHub: commit 3 file trên + `docs/AI-FIX-LOG.md`. `.claude/launch.json` chỉ là cấu hình chạy thử local, không cần commit.
- 13/10/2026: Người dùng yêu cầu xuất bản phần Claude đã sửa và thêm lên GitHub. Kiểm tra lại TypeScript và ESLint các file thay đổi thành công; không đưa `.claude/` và `pnpm-lock.yaml` vào commit.
# 2026-10-14 — Chế độ sáng/tối (local, chưa đẩy GitHub)

- Nút chuyển chế độ cạnh QuickSearch trong AppShell; có aria-pressed, hỗ trợ bàn phím, lưu `qlkt-theme` và đồng bộ tab qua storage event. Mặc định sáng, không tự chuyển theo hệ điều hành.
- Layout đọc lựa chọn trước khi vẽ để tránh nháy nền sáng; chế độ sáng giữ nguyên CSS hiện có. CSS tối được giới hạn theo data-theme, không dùng bộ lọc đảo màu ảnh/logo.
- Tham khảo bảng màu từ dự án VibraControl local `web theo dõi độ rung thiết bị quay/up web/ui.css` và `theme.css`. Web mẫu online chỉ hiển thị màn hình truy cập báo lỗi máy chủ lúc kiểm tra.
- Bản thử tương tác: `/wb-preview?live=1`; cache preview không có JavaScript nên không dùng để kiểm tra nút.
- Người dùng đã yêu cầu đẩy GitHub. TypeScript và ESLint các file thay đổi thành công. Kiểm tra runtime bị chặn bởi lỗi HTTP 500 `fetch failed` trong Miniflare/Cloudflare Vite khi tải preview; chưa xác nhận chuyển chế độ trực tiếp.
# 2026-10-14 — Favicon EVN (local)

- Dùng nguyên ảnh logo EVN do người dùng gửi tại `public/evn-logo.png`, không vẽ lại hoặc thay đổi màu logo.
- Metadata icon và shortcut đổi sang đường dẫn mới để tránh cache favicon biểu đồ cũ. Chỉ đổi biểu tượng tab, không thay logo trong giao diện.
- Người dùng đã yêu cầu xuất bản favicon EVN lên GitHub.

