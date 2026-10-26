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

# 2026-10-14 — Sửa tương phản tối và thanh trượt ngày/đêm (local)

- Nguyên nhân: CSS route Công việc Phân xưởng đặt chữ đen/nền trắng riêng; theme tổng quát không bao phủ và thua specificity ở các thành phần con.
- Bổ sung override chỉ trong `html[data-theme="dark"] .wp`: nội dung, người phụ trách/phối hợp, bảng, form, thẻ, board, popup, rich editor, trạng thái và hạn công việc. Không chỉnh CSS chế độ sáng.
- Đổi nút theme thành switch mặt trời/mặt trăng có nút trượt, aria-checked, bàn phím và reduced-motion. Giữ lưu lựa chọn và đồng bộ tab.
- Test tương phản 9 cặp màu chữ đạt tối thiểu 4.5:1, test guard CSS/switch đạt; ESLint component đạt. Preview dev Công việc có switch để QA, không đổi route production.
- Cài phụ thuộc đúng package-lock hoàn tất, TypeScript và ESLint đạt. Đã thử bật/tắt và tải lại tại `/work-px-preview` trên Next dev cổng 5174, xác nhận bảng và thẻ thống kê rõ chữ, chế độ sáng trở lại như cũ. Ảnh QA: `wb/dark-work-table.png`, `wb/dark-work-overview.png`.
- Chưa đẩy GitHub. Next dev tự sinh AGENTS.md/CLAUDE.md không thuộc thay đổi này, không stage chúng. Phát hiện riêng: proxy đang chuyển favicon PNG sang login khi chưa đăng nhập; chưa sửa trong yêu cầu tương phản.

# 2026-10-14 — Favicon EVN không méo (local)

> Xuất bản: người dùng yêu cầu đẩy cả bản sửa tối/thanh trượt và favicon SVG lên GitHub ngày 14/10/2026. Test tương phản và switch chạy lại đạt; ghi chú “chưa đẩy” dưới đây là trạng thái tại thời điểm sửa. Không đưa cấu hình local, AGENTS.md/CLAUDE.md tự sinh và pnpm-lock.yaml vào commit.

- Ảnh PNG gốc có khung chữ nhật và khoảng trắng lệch, bị ép khi hiển thị biểu tượng tab vuông. Thay bằng SVG viewBox vuông, tâm vòng tròn/ngôi sao trùng nhau, giữ ba màu EVN.
- Metadata dùng `/evn-favicon.svg`; proxy cho phép đúng asset favicon này khi chưa đăng nhập. Không mở quyền truy cập dữ liệu/API.
- Giữ ảnh PNG gốc, không thay đổi giao diện sáng/tối. Chưa đẩy GitHub.

# 2026-10-14 — Bổ sung theme tối PMIS và DateField (local)

- PMIS toolbar/panel có nền trắng riêng chưa được bao phủ; DateField dùng button text-black nên quy tắc input tối không có tác dụng.
- Override chỉ dark cho nền toolbar, tiêu đề, chú thích, biểu đồ PMIS, chữ đen legacy và nút chọn ngày. Giữ nguyên chế độ sáng.
- Thêm test hồi quy cho toolbar PMIS và chữ DateField. Chưa đẩy GitHub.

# 2026-10-14 — Rà soát theme tối các báo cáo, xuất bản

- Rà soát toàn bộ CSS component và lớp màu cố định trong component TSX. Bổ sung nền/chữ tối cho PMIS, nhóm báo cáo kỹ thuật BCSX/nước/hóa chất/KTKT, thống kê tháng, nút lọc PPA, tooltip Recharts, input khóa và popover chọn ngày.
- Nguồn lỗi: nền sáng và chữ đậm màu được hard-code trong CSS route hoặc utility riêng, không tự đổi theo token theme. Thêm override chỉ dark + screen, không sửa CSS sáng hoặc tính toán dữ liệu.
- Các utility màu nền nhạt chuyển sang nền tối theo nhóm ngữ nghĩa (đỏ/cảnh báo, xanh/đạt, vàng/lưu ý); giữ các nút nền đậm và ảnh/logo. Không đảo màu toàn trang.
- Thêm test guard các nhóm component và kiểm tra tương phản các cặp màu. Người dùng yêu cầu sửa và đẩy GitHub.
- Lần này không kiểm tra trực tiếp được trong trình duyệt do công cụ từ chối truy cập local; không tuyên bố đã kiểm tra mọi trang/trạng thái runtime. Cần người dùng tải lại web và đối chiếu các màn hình dữ liệu thật sau triển khai.

# 2026-10-14 — Hook tối riêng cho KTKT và ngày báo cáo (local)

- Theo ảnh phản hồi, thêm class ktkt-role-banner và qlkt-date-field để override chính xác, không phụ thuộc vào tên utility màu. Chỉ có quy tắc dark, CSS sáng không thay đổi.
- Banner quyền, tiêu đề cụm, nhãn cương vị/báo cáo gốc, header bảng KTKT có nền/chữ tối rõ; ngày báo cáo đặt cả color và WebKit text fill để không còn chữ đen.
- Thêm test hồi quy hooks, không đổi dữ liệu/công thức/định dạng ngày. Người dùng yêu cầu xuất bản lên GitHub. 5 test đạt; ESLint không lỗi, 2 cảnh báo điều hướng cũ. Chưa xác nhận trên web production.

# 2026-10-15 — API tích hợp PMIS/PPA (local, chưa kích hoạt production)

- Người dùng xác nhận backend pxvh1.infinityfree.me được đọc PMIS và SHN/PPA. Tạo khóa ngẫu nhiên 256-bit trong .sites-runtime/private (gitignored), không in khóa ra log hoặc commit. Vercel chỉ lưu SHA256; xóa/đổi hash và redeploy để thu hồi.
- Route riêng /api/integration/v1/operating-data, Bearer auth constant-time, fail closed khi chưa cấu hình, GET theo tháng và whitelist dataset; không nới quyền API phiên đăng nhập khác. Không trả file nguồn, ghi chú hay tài khoản.
- Test auth/header/query và tháng đạt. Hướng dẫn kích hoạt ở docs/INTEGRATION-API.md. Người dùng yêu cầu đẩy mã lên GitHub; không đẩy khóa. Chưa thêm env Vercel, chưa chuyển khóa sang InfinityFree.
- Lưu ý chưa xác minh đối chiếu dữ liệu SHN/NH3 từ KTKT lưu với tổng hợp động của báo cáo; cần hoàn tất đối chiếu trước sử dụng vận hành. Không có rate limit phân tán, giới hạn một tháng mỗi query.

# 2026-10-25 — Gemini đọc ảnh công tơ than, đối chiếu và lưu bốn mốc ca (local)

- Người dùng yêu cầu Gemini đọc tên máy cấp và chỉ số lũy kế tấn; xác nhận giữ theo 4 mốc ca gần nhất. Khóa gửi trong chat không được ghi vào mã/env/log hoặc dùng để gọi API; cần thu hồi và cấu hình khóa mới.
- Route OCR chuyển sang Gemini REST, schema Zod, kiểm tra đơn vị tấn, timeout, lỗi quota; chỉ server đọc GEMINI_API_KEY/GEMINI_VISION_MODEL. Chưa cấu hình trả 503. Giới hạn body stream, chữ ký ảnh, 72 lượt/giờ/tài khoản và kho 40 triệu ký tự base64.
- Giữ nhãn/giá trị ảnh, không gán máy cấp dựa trên số gần giống; sửa lỗi ánh xạ FileList khi có file không hợp lệ. Ảnh lớn cạnh bảng; người nhập phải tích Ghi rồi Điền và Lưu số liệu. Key={date} tránh mang ảnh sang ngày báo cáo khác.
- Kho ảnh có quyền tài khoản, owner_id và expires_at; nhãn/số lưu là AI ban đầu. Hết hạn theo endpoint ca +4 mốc (08/16/24 giờ VN), không theo thời điểm upload. Ảnh hết hạn chặn xem ngay; dọn vật lý theo truy cập và cron hằng ngày, có thể trễ 24h; không xóa số liệu vận hành. Đổi cron dọn ba lần/ngày cần scheduler phù hợp, chưa tự mở dịch vụ trả phí.
- Đã kiểm tra TypeScript, ESLint các file mới, 12 test chuyên biệt (gồm guard archive) và toàn bộ test hiện có đều đạt. Chưa thử Gemini thật, DB/cron production hoặc kiểm tra UI bằng ảnh công tơ thật. Hướng dẫn ở docs/COAL-METER-GEMINI.md.
- Người dùng yêu cầu đẩy GitHub và kích hoạt ngày 25/10. Đã kiểm tra Vercel nhưng đang ở trang login; chưa cấu hình GEMINI_API_KEY/GEMINI_VISION_MODEL/CRON_SECRET. Mã được xuất bản riêng, không đưa bí mật vào Git và không tuyên bố đã kích hoạt.

# 2026-10-25 — Khóa Gemini tạm cho thử nghiệm không cần quyền Vercel

- Người dùng muốn thử nghiệm khi chưa có quyền cấu hình Vercel. Thêm ô khóa password và model trong cửa sổ đọc ảnh; không hard-code khóa đã gửi trong chat.
- Backend chấp nhận khóa cho từng request sau kiểm tra đăng nhập/quyền, định dạng và giới hạn lượt đọc như cũ. Không lưu key trong DB/log; client không localStorage, đóng cửa sổ xóa giá trị state.
- Khóa tạm không sửa biến môi trường. Header model chỉ có tác dụng với khóa tạm; dùng khóa server thì không cho client chọn model khác để tránh phát sinh chi phí ngoài cấu hình.
- TypeScript và 15 test chuyên biệt đạt. Chưa gọi Gemini thật hoặc thử bằng ảnh công tơ thực tế. Đẩy GitHub theo yêu cầu kích hoạt đang tiếp tục; sau deploy có thể thử bằng khóa tạm, còn cron nền vẫn chưa kích hoạt nếu thiếu CRON_SECRET.

# 2026-10-25 — Ô nhập khóa Gemini dùng chung cho VHV (local)

- Người dùng yêu cầu VHV có thể nhập/lưu khóa lên server cho các VHV khác dùng chung. API mới /api/coal-gemini-settings dùng session + quyền nhập nhóm than S1 hoặc S2; không public và không mở rộng quyền tài khoản xem báo cáo.
- Khóa dùng chung mã hóa AES-256-GCM bằng khóa dẫn xuất riêng theo ngữ cảnh từ AUTH_SECRET đã tồn tại; plaintext không vào Git, DB hay log. GET chỉ trả trạng thái/model/version/người-thời điểm thay khóa.
- Compare-and-swap version chống ghi đè đồng thời; audit thay khóa không lưu bí mật. Khóa chung dùng cho tất cả VHV có quyền, không phải chỉ người đã lưu. Tạm theo lượt đọc ưu tiên hơn khóa chung; môi trường là fallback khi chưa có khóa chung.
- UI có ô password và Lưu khóa dùng chung lên server, xóa giá trị ô sau lưu, hiển thị người lưu. Khóa tạm giữ trong mục riêng. Bảng đối chiếu có vùng cuộn để form mới không che bảng trên màn hình nhỏ.
- TypeScript, ESLint, next build và toàn bộ test đạt; 18 test liên quan gồm mã hóa/khóa sai/tamper, lưu và thay giữa hai VHV trên SQLite memory, metadata/audit không có key và CAS conflict. Xuất bản GitHub trong luồng yêu cầu kích hoạt đang tiếp tục. Chưa lưu khóa thật, chưa gọi Google hoặc xác nhận UI/DB production.

# 2026-10-25 — Nút TKĐ đối chiếu ảnh và số bảng than (local)

- Thêm nút Đối chiếu ảnh & số liệu cạnh Đọc công tơ từ ảnh tại S1/S2. Cửa sổ ảnh lớn + AI đọc + số màn hình hiện tại + chênh lệch, đơn vị tấn. Chỉ đọc, không tự sửa/ghi bảng hoặc đánh dấu đã xác nhận.
- TKĐ được xem chéo ảnh các VHV qua scope=review nếu có quyền ctktkt_tkd_trend hoặc quyền rộng hơn (edit_ctktkt/admin). VHV chỉ nhập than giữ quyền ảnh của mình; viewer không được xem chéo. Kiểm tra quyền và expires_at cả list và URL ảnh.
- Hiển thị rõ ô trống/không rõ máy/không rõ số/ảnh lỗi, không biến chúng thành khớp. Cho TKĐ chọn lại máy/ca để đối chiếu mà không sửa bảng. Cảnh báo số trên màn hình có thể chưa lưu và số AI có thể sai.
- Test quyền TKĐ, ô S1/S2 theo ca, giữ nguyên dữ liệu và trạng thái thiếu/mất số đạt; TypeScript và lint component mới đạt. Người dùng yêu cầu xuất bản GitHub; 15 test liên quan chạy lại đạt. Chưa thử UI/ảnh thật trên production.

# 2026-10-25 — Thiết kế lại nhập ảnh công tơ, xóa/đọc lại và phân loại lỗi (local)

- Phản hồi: form khóa, bảng và ảnh chồng lên nhau; lỗi đọc/lưu ảnh không rõ nguyên nhân. CSS toàn cục `[role="dialog"]:has(table)` thay cấu hình hàng grid của cửa sổ nhiều phần, kết hợp bảng tối thiểu 920px gây tràn và co vùng nhập. Không sửa quy tắc của các cửa sổ khác; cửa sổ than mới dùng flex, header/footer cố định và một vùng nội dung cuộn, không còn bảng rộng.
- Danh sách ảnh + vùng đối chiếu lớn với công tơ, mốc ca, chỉ số tấn, số trước và mức tăng. Cấu hình Gemini thu gọn. CSS Module dùng màu sáng/tối riêng, bám `html[data-theme]` của dự án; không thay theme sáng của các trang khác. Mobile chuyển thành một cột, danh sách ảnh cuộn ngang trong vùng riêng.
- Thêm Thay ảnh, Đọc lại từng ảnh/ảnh lỗi, Xóa từng ảnh, Xóa tất cả/dừng. Giữ File để thử lại, reset input để chọn lại cùng file. AbortController + generation guard ngăn kết quả cũ quay lại sau xóa/đóng; thu hồi object URL khi bỏ ảnh/unmount. Xóa trong lượt nhập không xóa dữ liệu vận hành hoặc ảnh đã lưu trên server. Ca cũ được giữ khi đọc lại, trừ khi ảnh có giờ chụp rõ.
- Chỉ ghi các ảnh người nhập đã đối chiếu; sửa số/công tơ/ca bỏ xác nhận cũ, ô trùng máy/ca hoặc không có quyền không được điền. Khi AI lỗi có Nhập tay từ ảnh với cảnh báo rõ chưa có kết quả AI/chưa lưu ảnh. Vẫn phải bấm Lưu số liệu ở bảng chính.
- Animate UI: CLI dry-run rồi `animate coal-dialog`, wrapper riêng trong `components/ui/coal-dialog.tsx`; giữ dialog chung hiện có. Thêm @animate-ui/react 2.x + motion 14.x bằng npm/package-lock đang được Git theo dõi. Giữ file pnpm-lock.yaml chưa theo dõi của workspace. Primitive xử lý mở/đóng, reduced motion; có trả focus về nút mở và quản lý focus lúc xóa.
- Phân loại lỗi mạng/timeout 45 giây, khóa Google không hợp lệ, quyền/model, quota, dịch vụ và phản hồi bị ngắt. Không phản chiếu thông báo thô từ nhà cung cấp (có thể chứa khóa). Tách lỗi kiểm tra quota kho ảnh trước khi gọi Gemini. Nếu đọc thành công nhưng lưu ảnh thất bại, trả số đã đọc kèm cảnh báo chưa lưu ảnh thay vì vứt bỏ kết quả.
- Xác minh: baseline và sau sửa TypeScript đạt; ESLint các file sửa đạt; 23 test nhóm công tơ/khóa/quyền/ảnh đạt, gồm mock timeout, lỗi mạng, key/quyền/model/quota và phản hồi không phải JSON; toàn bộ bộ test đạt. Next production build đạt. Bản xem trước `/wb-preview#coal-photo-design` chỉ tồn tại trong development, dùng request adapter giả lập, không gọi Google, DB hoặc lưu khóa thật.
- Kiểm tra trình duyệt bản local: tải ảnh, chọn lại cùng ảnh, sửa số làm mất xác nhận, xác nhận/điền đúng X16, lỗi đọc và hủy giữa chừng; không tràn ngang ở viewport 1280 và 390, footer trong màn hình; hai cột ở 1440. Kiểm tra dark có nền/chữ tương phản, reduced motion giữ tỉ lệ/không xoay và mở/đóng Enter trả focus đúng nút.
- Giới hạn: production đang hiển thị lỗi chung từ Gemini, chưa có HTTP reason chi tiết của lần lỗi người dùng. Không khẳng định khóa thật hoặc quota Google đã được sửa/kiểm tra. Chưa gửi ảnh thật tới Google trong lượt này; sau triển khai cần thử lại để thấy đúng nhóm lỗi và xác nhận lưu ảnh cho TKĐ. Quyền ảnh và thời hạn 4 mốc ca giữ nguyên. Chưa đẩy commit của lượt thiết kế này.

# 2026-10-25 — Kiểm tra lỗi ảnh rõ nhưng dịch vụ báo thất bại, chuẩn bị triển khai

- Người dùng xác nhận cho đẩy GitHub và kiểm tra web thật bằng khóa đã lưu. Trang đang mở vẫn là giao diện cũ; thông báo catch chung không chứng minh ảnh mờ. Trạng thái lưu khóa trước đây chưa xác thực khóa với Google.
- Thêm POST `/api/coal-gemini-settings/check`: session, quyền nhập than S1/S2, kiểm tra Origin; chỉ máy chủ giải mã khóa và gọi GET models/{model} của Google với timeout 12 giây. Không gửi ảnh, không gọi generateContent, không đổi khóa hoặc dữ liệu vận hành. Phản hồi không có khóa, không phản chiếu lỗi thô của nhà cung cấp.
- Trong Cấu hình Gemini có nút Kiểm tra khóa đã lưu. Phân biệt lưu được khóa và kiểm tra được khóa/model; kết quả metadata thành công vẫn ghi rõ chưa kiểm tra hạn mức OCR. Nút kiểm tra chỉ dùng khóa trên server, không lấy ô khóa mới chưa lưu. Tài liệu đối chiếu: https://ai.google.dev/api/models#method:-models.get.
- Lỗi HTTP Google trả về mã 400/401/403/404/429/5xx riêng; 400 không còn gợi ý đổi ảnh rõ hơn khi chưa có bằng chứng. Test thêm probe GET-only, không key trong URL/body/phản hồi, model thiếu generateContent, key lỗi, mạng lỗi. 14 test nhóm Gemini/key/retention đạt; TypeScript và lint đạt. Đang chờ triển khai để ghi kết quả thực tế, chưa kết luận khóa của người dùng sai.

## Kết quả trên production sau commit a5c5a34

- Đã đẩy main, Vercel báo success. Endpoint kiểm tra trả 401 khi không có phiên đăng nhập; khi đăng nhập đã mở được giao diện mới và đọc trạng thái cấu hình.
- Dùng đúng ảnh gốc người dùng từng tải, tên bắt đầu 1792861228348 trong Downloads: bằng mắt thấy nhãn 1A2, Material Total 85099.680 MTons, thời điểm 24/10/2026 23:57. Không dùng ảnh chụp màn hình lỗi làm mẫu OCR. Không bấm Điền hoặc Lưu số liệu.
- Lượt generateContent thật bị Google trả HTTP 401; chưa có kết quả nhận dạng, chưa ghi bảng vận hành. Vì vậy lỗi tái hiện nằm ở xác thực yêu cầu Google, không có bằng chứng do ảnh khó đọc. Chưa suy diễn là key hết hạn hay chắc chắn sai; khóa auth AQ và x-goog-api-key đều là cách dùng được Google hỗ trợ (https://ai.google.dev/gemini-api/docs/api-key).
- Phát hiện probe models.get HTTP 200 không đủ xác nhận quyền generateContent (bước đọc ảnh sau đó vẫn 401). Sửa probe sang models.list để kiểm tra catalog, trạng thái UI không còn nói đã xác thực được quyền đọc. Cả catalog thành công cũng nêu rõ chưa kiểm tra quyền/quota generateContent. Chỉ hiển thị ErrorInfo reason thuộc whitelist, không trả message hay metadata thô của Google.
- Thêm test hồi quy trường hợp model metadata 200 không được coi là probe catalog thành công và HTTP 401 không đổ cho ảnh, không lộ nội dung lỗi bí mật. 15 test nhóm Gemini/key/retention đạt. Cần chủ khóa kiểm tra trạng thái/ràng buộc/quyền tại Google AI Studio nếu lỗi xác thực vẫn còn; không thay hoặc nới quyền Google của người dùng trong lượt kiểm tra này.

# 2026-10-25 — Đối chiếu khóa AQ mới bằng REST độc lập và đúng hàm OCR

- Người dùng cung cấp khóa mới để kiểm tra cách gửi. Không lưu khóa vào tệp dự án, Git, dữ liệu thử hoặc thông báo kết quả. Đọc tài liệu chính thức https://ai.google.dev/gemini-api/docs/api-key và https://ai.google.dev/api/generate-content: gửi nguyên khóa ở x-goog-api-key tới generativelanguage.googleapis.com, không giải mã AQ, không đổi thành Bearer.
- Kiểm tra có kiểm soát: models.list bằng khóa mới trả 200 và có model đã cấu hình; gọi cùng catalog không khóa trả 403. generateContent văn bản ngắn trên gemini-3.8-flash hai lần trả 503 UNAVAILABLE với dấu hiệu quá tải. Một đối chiếu model gemini-2.5-flash trả 404; không đổi model mặc định theo phỏng đoán. Chạy đúng readCoalMeterGemini của dự án bằng Node với ảnh gốc 1A2 cũng trả Google HTTP 503, không phải 401 và không có kết quả OCR. Dùng biến tiến trình tạm và dọn sau gọi; chỉ in HTTP/status/reason đã lọc. Kết nối từ Node REPL không khả dụng, không coi lỗi vận chuyển đó là phản hồi Google.
- Bằng chứng này chưa xác định nguyên nhân mọi lần 401 của web, nhưng loại trừ nhận định rằng cứ khóa AQ là phải chuyển sang Bearer hoặc ảnh khó đọc. Kiểm tra code thấy khóa tạm ưu tiên hơn khóa chung ngay cả khi mục khóa tạm đã thu gọn; lỗi hàng ảnh cũng giữ kết quả cũ tới khi Đọc lại. Đây là hai nguồn gây nhầm cần làm rõ, chưa khẳng định người dùng đang ở đúng tình huống đó.
- Thêm dòng Nguồn khóa đang dùng và nút Dùng khóa chung luôn thấy khi có khóa tạm. Lưu khóa chung thành công xóa khóa tạm của lượt nhập. Thông báo lỗi ảnh ghi rõ kết quả lần đọc trước, cần Đọc lại sau thay khóa. Không tự cập nhật khóa Google/CSDL bằng khóa lấy từ chat.
- Kiểm tra Gemini nay gọi generateContent bằng 1 yêu cầu văn bản ngắn, maxOutputTokens=32, dùng đúng nguồn khóa/model của OCR (helper header dùng chung và cùng quy tắc ưu tiên ở server). UI thông báo có dùng hạn mức; probe nằm trong giới hạn 72 lượt đọc/kiểm tra mỗi giờ/tài khoản. Không gửi ảnh hoặc sửa số liệu ở probe. STOP/MAX_TOKENS 200 xác nhận Google đã chạy yêu cầu thử, không bảo đảm độ chính xác OCR. Metadata/catalog 200 không được coi là đã gọi mô hình thành công.
- HTTP 503 được phân loại dịch vụ quá tải/tạm không khả dụng và giữ status 503; không yêu cầu thay khóa khi chỉ có 503. 401 vẫn là xác thực, không tự retry bằng phương thức khác. Không ghi log lỗi Google thô.
- 28 test công tơ/khóa/quyền/retention đạt, gồm khóa AQ tổng hợp giữ nguyên từng ký tự qua browser/server/Google, không Authorization/key trong URL/body, chuyển sang khóa chung bỏ cả hai header tạm, probe thực và lỗi 503. TypeScript, ESLint và production build đạt. Điều khiển trình duyệt đang bị tắt trong Work nên chưa kiểm tra tương tác bản này trên production; cần tải lại web, xem nguồn khóa và thử lại bằng khóa mong muốn sau triển khai.


# 2026-10-25 — Đọc công tơ than: tự thử lại khi Gemini quá tải

Hiện tượng (ảnh người dùng gửi): «Chưa đọc được ảnh — Dịch vụ Gemini đang quá tải hoặc tạm thời không khả dụng… (Google HTTP 503)». Đây là lỗi tạm thời phía Google (model đang quá tải), không phải lỗi khóa hay lỗi ảnh. Trước đây `readCoalMeterGemini` gọi Google đúng 1 lần nên gặp 503 là báo lỗi ngay, người dùng phải tự bấm Đọc lại nhiều lần.

- `lib/coal-meter-gemini.ts`: khi Google trả 500/502/503/504 hoặc lỗi mạng, tự thử lại tối đa 2 lần, chờ 2 s rồi 5 s (tôn trọng `Retry-After` ≤ 8 s). Tổng thời gian ≤ 55 s, nằm trong `maxDuration = 60` của `/api/coal-meter-ocr`; không thử lại nếu không còn đủ 10 s cho một lần gọi. Hết thời gian chờ (timeout) thì không thử lại. Không thử lại 429 (hết hạn mức), 400/401/403/404 (khóa/model sai). Nếu vẫn lỗi, thông báo ghi thêm «Đã tự thử lại N lần».
- Mỗi lượt bấm Đọc vẫn chỉ tính 1 lượt trong giới hạn 72 lượt/giờ, vì giới hạn được trừ ở route trước khi gọi Gemini.
- Phía trình duyệt không giới hạn thời gian cho yêu cầu đọc ảnh, nên các lần thử lại không bị ngắt.
- `tests/coal-gemini.test.mjs`: thêm test cho 503→503→thành công, 503 liên tục (báo số lần thử lại), 429/401/400 không thử lại, và giữ trong ngân sách thời gian. Các test cũ dùng `sleep` giả nên không chậm.
- `tests/work-px-workspace.test.mjs`: đổi tên biến `module` → `cjsModule` để hết lỗi ESLint `no-assign-module-variable` có sẵn, không đổi hành vi.
- Kiểm tra: tsc sạch, lint 0 lỗi, test 448/448.
- Nếu Google quá tải kéo dài, vẫn có thể báo 503 sau khi đã thử lại. Khi đó dùng «Nhập tay từ ảnh» hoặc đổi model trong Cấu hình Gemini.
- Theo yêu cầu người dùng, đưa bản sửa Claude lên GitHub cùng nhật ký. Codex kiểm tra lại: toàn bộ test, TypeScript, ESLint cho các file sửa và `git diff --check` đạt. Chưa xác nhận đọc ảnh thành công trên production; cơ chế thử lại không sửa lỗi xác thực HTTP 401.
- Kiểm tra build local: Turbopack lỗi nội bộ khi khởi tạo tiến trình xử lý `app/interface.css`, kể cả khi chạy ngoài giới hạn tiến trình. `next build --webpack` hoàn tất thành công. Không thay cấu hình triển khai; cần theo dõi kết quả Vercel sau khi đẩy.

# 2026-10-25 — Xác minh 401 trên production và chọn rõ nguồn khóa

- Tái hiện trực tiếp trong Chrome đang đăng nhập: nguồn khóa hiện là **khóa tạm**, nút Kiểm tra Gemini trả `Google HTTP 401 · ACCESS_TOKEN_TYPE_UNSUPPORTED`. Chuyển bằng **Dùng khóa chung**, gọi kiểm tra mới trả `Google HTTP 429`. Đây là hai phản hồi từ hai nguồn khóa khác nhau; không quy lỗi cho chất lượng ảnh hoặc khẳng định mọi quyền/hạn mức đã hợp lệ. Không đọc hay ghi lại nội dung khóa.
- Code trước đó tự ưu tiên khóa tạm chỉ cần ô có giá trị, kể cả khi phần nhập bị thu gọn. Chưa xác định giá trị đó do người nhập hay trình duyệt điền lại. Sửa `components/coal-meter-photo-import.tsx`: mặc định chọn khóa chung; phải bấm **Chọn dùng khóa tạm** mới tạo ô nhập và dùng khóa tạm cho cả OCR lẫn kiểm tra. Thoát cửa sổ, chuyển sang khóa chung hoặc lưu khóa chung đều xóa chế độ và giá trị tạm. Khóa tạm rỗng báo yêu cầu nhập/chuyển nguồn, không âm thầm gọi bằng khóa chung. Không tự chuyển nguồn khi Google báo lỗi.
- `tests/coal-photo-key-source.test.mjs`: kiểm tra hành vi component và header của yêu cầu thực qua mock, gồm mặc định không có ô password tạm, chủ động bật mới dùng khóa tạm, khóa tạm rỗng không gửi, chuyển nguồn/lưu chung/đóng cửa sổ xóa override.
- 33 test liên quan đạt; TypeScript, ESLint các file sửa, `next build --webpack` đạt. Build Turbopack trên máy này vẫn có hạn chế đã ghi ở mục trước. Không thay cấu hình triển khai, không đưa khóa vào mã nguồn hay log.
- Bản Claude `4a92396` đã được Vercel xác nhận triển khai thành công. Chưa đọc được chỉ số qua Gemini trên production; không điền hay lưu số vận hành khi thử nghiệm. Hạn mức/dịch vụ Google là vấn đề riêng cần kiểm tra sau khi chọn đúng nguồn.
- Thử lại đúng ảnh công tơ đã được cho phép bằng khóa chung: không còn 401 trong lần thử này nhưng Google không phản hồi trong timeout 45 giây; giao diện giữ ảnh và báo chưa có chỉ số được điền. Không coi phản hồi 429 hoặc timeout là bằng chứng OCR thành công.

# 2026-10-26 — Đối chiếu VibraControl và sửa cấu hình OCR CTKTKT

- Người dùng xác nhận nhận diện ảnh hoạt động tại `https://pxvh1.infinityfree.me/?i=1`. Đối chiếu mã nguồn đang phát triển trên máy: `D:/Dự an AI/web theo dõi độ rung thiết bị quay/up web/api/ai-gemini.php` mặc định **gemini-3.5-flash-lite**; `mill-meter.php` dùng REST `generateContent`, header `x-goog-api-key`, schema JSON gọn. CTKTKT trước đó mặc định **gemini-3.8-flash**, không đặt mức thinking, không gửi responseSchema và gọi tối đa 3 ảnh cùng lúc. Chưa khẳng định khóa/hạn mức hai web giống nhau hay mã nguồn local đồng nhất hoàn toàn với cấu hình hosting đang chạy.
- API CTKTKT vốn chạy trong Vercel Function (`/api/coal-meter-ocr`); khóa chung giải mã trên máy chủ. Lưu khóa vào biến môi trường Vercel là một lựa chọn quản lý bí mật, không tự sửa 401/429/503 hoặc tăng hạn mức Google. Khóa chung DB đang có ưu tiên hơn khóa environment; không đưa khóa vào Git hoặc sao chép khóa từ web khác.
- Chọn mặc định **gemini-3.5-flash-lite** cho cấu hình mới. Không âm thầm thay model đã lưu: bổ sung **Chọn model đọc nhanh** và **Lưu model, giữ nguyên khóa**. PUT cấu hình nhận key rỗng để chỉ cập nhật model; CAS theo version, audit action=model, giữ nguyên ciphertext và không cần giải mã/đưa khóa về trình duyệt. Nút model-only luôn gửi key rỗng kể cả trình duyệt tự điền ô thay khóa. Quyền nhập than, kiểm tra Origin, giới hạn body và validation model giữ nguyên.
- OCR gửi responseSchema gọn đúng 7 trường như bên VibraControl, tiếp tục Zod validation tại server và kiểm tra đơn vị tấn. Giảm thinking theo họ model đã được tài liệu Google xác nhận: 3.5/3.1 Flash-Lite minimal, 3.8/3.7 Flash low; model tùy chỉnh giữ nguyên cấu hình để tránh lỗi tham số 400. Probe dùng cùng cấu hình thinking, tối đa 256 output tokens. Ảnh xử lý lần lượt thay vì 3 yêu cầu đồng thời; không tự đổi model/khóa khi lỗi hay tự ghi số vận hành. Timeout không còn hướng người dùng thay ảnh rõ hơn khi chưa có bằng chứng ảnh kém.
- Xác minh: test Gemini, schema/thinking, CAS model-only giữ ciphertext, giao diện model-only không gửi nội dung ô khóa, kiểm tra nguồn khóa đều đạt. Toàn bộ bộ test trước thay đổi nút cuối đạt; test mới cho nút cuối đạt. TypeScript/ESLint và build Webpack được kiểm tra lại trước triển khai. Chỉ chốt OCR thành công sau khi đọc ảnh thật trên production, không dựa vào probe văn bản.
- Tài liệu đối chiếu: https://ai.google.dev/gemini-api/docs/generate-content/thinking ; https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite ; https://ai.google.dev/gemini-api/docs/api-key ; https://vercel.com/docs/functions/debug-slow-functions .
- Kết quả production: commit **7af6663** được Vercel xác nhận triển khai thành công. Ngày 26/10/2026, dùng phiên Chrome đã đăng nhập, bấm **Chọn model đọc nhanh → Lưu model, giữ nguyên khóa**; máy chủ xác nhận model chung **gemini-3.5-flash-lite**. Không nhập/thay/đọc nội dung khóa.
- Đã đọc **thành công ảnh công tơ thật** trước đó từng bị lỗi: nhận đúng mã máy cấp, chỉ số tích lũy khớp ảnh gốc và mốc 24h; giao diện báo 0 lỗi. Bảng đang mở ngày khác ngày ảnh nên cảnh báo đúng ngày chụp và số nhỏ hơn lần trước. Không bấm xác nhận, Điền hoặc Lưu số liệu. Đây là kiểm tra OCR ảnh thực, không phải chỉ probe văn bản. Thành công một ảnh không bảo đảm Google luôn sẵn sàng hoặc mọi hạn mức/model khác đều dùng được; giữ cơ chế đối chiếu thủ công và xử lý lỗi.

# 2026-10-26 — Ngày ghi, bảng tổng hợp và xác nhận lưu công tơ từ ảnh

- Theo yêu cầu người dùng, thêm **Ngày ghi chỉ số** cạnh nút thêm ảnh và mốc ca, mặc định đúng ngày báo cáo đang mở. Ngày đồng bộ về báo cáo chính; chặn tương lai, giữ quyền sửa ngày D/D-1 và chặn đổi ngày khi bảng chính còn dữ liệu chưa lưu. Bỏ key theo ngày của modal để giữ ảnh khi đổi ngày; mọi xác nhận cũ bị hủy. Ảnh OCR theo ngày cũ phải đọc lại hoặc nhập tay cho ngày mới trước khi lưu, không ngầm chuyển ảnh đã lưu sang ngày khác.
- Thêm **Bảng thông số công tơ** ngay dưới phần đối chiếu: mỗi ảnh có máy cấp, ca, lần trước, chỉ số, lượng tăng và ô xác nhận; ảnh chưa rõ có thao tác Nhập tay/Tải lại ảnh. Bảng cuộn ngang riêng trên điện thoại, modal vẫn flex và footer luôn hiện; CSS scoped tránh quy tắc dialog:has(table) toàn cục làm lệch bố cục.
- Confidence không cao, không có total, sai loại màn hình hoặc kết quả AI lỗi: chưa cho xác nhận lưu. Chọn Nhập tay sẽ xóa giá trị để người dùng tự nhập sau khi đối chiếu, hoặc thay ảnh/đọc lại. Sửa công tơ, mốc, số hay ngày đều bỏ xác nhận trước đó. Chỉ các dòng được phép, không trùng đích và đã tích xác nhận mới được gửi.
- Thêm lưu trực tiếp trong cửa sổ ảnh bằng **Xác nhận và lưu**. `lib/coal-photo-save.ts` chỉ gửi các ô công tơ được xác nhận kèm ngày đã chọn tới API CTKTKT hiện hữu (giữ quyền, khóa ngày và audit của server). Đọc lại số từ server đúng ngày rồi mới báo thành công. Parent chỉ cập nhật các ô công tơ vừa xác minh, giữ các ô/dirty khác. Lưu thất bại giữ ảnh, số và xác nhận để kiểm tra/thử lại, không báo lưu giả.
- Test: helper gửi đúng ngày/ô, từ chối ô ngoài than và trùng đích, đọc lại sai ngày/sai số không thành công; UI ngày mặc định, đổi ngày bỏ xác nhận, low-confidence phải nhập tay, lưu thành công/thất bại. Toàn bộ bộ test đạt. TypeScript và ESLint file mới/sửa đạt; báo cáo chính còn hai cảnh báo điều hướng có sẵn. Build Webpack đạt.
- Kiểm tra Chrome local bằng adapter phát triển `/wb-preview#coal-photo-design`: lưu/đọc lại giả lập đạt; ảnh low-confidence chặn lưu, nhập tay được xác nhận; đổi ngày bằng bàn phím hủy xác nhận; 1280px modal không tràn và 390px bảng cuộn ngang riêng/footer vẫn hiện. Bản minh họa không gọi Google hoặc ghi dữ liệu vận hành thật. IAB không truy cập được localhost nên dùng Chrome; dev chạy Webpack vì Turbopack local gặp lỗi tiến trình đã ghi trước đó.
- Production: **ac75951** được Vercel xác nhận triển khai thành công. Trong tab riêng đang đăng nhập, xác nhận ô ngày khớp ngày báo cáo mặc định và đọc lại ảnh thật thành công; bảng tổng hợp hiện đúng máy cấp/ca/số và cảnh báo ngày ảnh khác ngày báo cáo. Không tích xác nhận hoặc lưu số vận hành trên production; thao tác lưu và đọc lại chỉ thử bằng adapter giả lập và unit test. Ảnh chụp giao diện lưu local ngoài Git.

# 2026-10-26 — Bỏ chế độ tối và hiệu ứng menu theo yêu cầu mới

- Giao diện cố định sáng tại root layout (data-theme=light, color-scheme=light), bỏ script khôi phục chế độ tối và xóa lựa chọn `qlkt-theme` cũ khi tải trang. Bỏ nút sáng/tối khỏi header và hai trang preview; xóa component toggle, stylesheet dark-theme cùng các test chỉ dành cho tính năng tối đã bị bỏ. Tailwind dark variants chỉ kích hoạt qua data-theme tối (không còn được đặt), tránh máy có giao diện hệ điều hành tối tự làm đổi giao diện web. Thông báo Sonner cố định sáng.
- Menu bỏ thanh sáng/glow, đo vị trí chuột, listener resize, timer trượt, hiệu ứng hiện từng mục và transition mở/thu. Nhóm menu ẩn/hiện ngay bằng hidden, giữ trạng thái đã thu, nhóm trang đang mở, aria-expanded/aria-controls và liên kết điều hướng. Mục đang chọn dùng màu phẳng; mobile drawer/overlay bỏ animation riêng, không ảnh hưởng chuyển động các cửa sổ nghiệp vụ khác.
- Toàn bộ bộ test còn áp dụng đạt; ESLint các file sửa đạt. Build Webpack và TypeScript được xác minh trước triển khai. Lần chạy tsc riêng song song với build có lỗi file .next/types đang được tạo lại; kiểm tra TypeScript trong build đạt, không đổi tsconfig để che lỗi sinh file tạm.
- Kiểm tra production sau c33919d: HTML/JS đã sáng, không còn nút tối/glow; CSSOM vẫn chứa bộ quy tắc menu cũ từ asset immutable (transition 0.2s, grid mở/thu). Chuyển entry stylesheet sang `interface-light.css` và cập nhật import để tạo dependency/asset mới, tránh tiếp tục dùng bundle cũ. Không kết luận nguồn cache phía trình duyệt hay build khi chưa có log; xác minh lại CSS tính toán trên production sau triển khai.
- Production **37588c2** triển khai thành công, đã kiểm tra sau tải lại: data-theme=light, color-scheme=light, không có nút tối/glow; mọi link menu có transitionDuration=0s, animationName=none, transform=none. Nhóm menu thu có hidden=true và display=none, hoạt động tức thì. Ảnh xác nhận lưu local ngoài Git; không sửa dữ liệu nghiệp vụ.

# 2026-10-26 — Chọn tổ máy và cảnh báo công tơ lẫn S1/S2

- Thêm **Tổ máy nhập** (S1/S2) trước ô ngày của cửa sổ OCR, mặc định theo tổ máy đang mở trong bảng chính (khi xem cả hai, mặc định S1 và người dùng có thể đổi). Giải thích ngay dưới thanh nhập: số đầu 1 thuộc S1, số đầu 2 thuộc S2; ví dụ 1D1/2D1. Không suy tổ máy từ giá trị chỉ số.
- `coalPhotoUnitIssue` kiểm cả nhãn AI đọc được lẫn công tơ gán. Ảnh 2D1 chọn đích S1-D1 vẫn bị cảnh báo/chặn xác nhận, không cho đổi ô đích để lách kiểm tra tổ máy. Lượt có cả S1/S2 hiện cảnh báo tổng; ảnh khác tổ tô cảnh báo và có nút Bỏ ảnh khác tổ, không nằm trong số liệu được phép lưu. Các ảnh đúng tổ vẫn có thể được đối chiếu/lưu riêng. Đổi tổ bỏ mọi dấu xác nhận trước đó; dropdown công tơ không cho chọn mã ngoài tổ hiện tại. Giữ mã đọc từ ảnh để người dùng biết ảnh thuộc tổ nào.
- `saveReviewedCoalEntries` kiểm danh sách chỉ thuộc một tổ và đúng tổ đang chọn trước khi gửi; gửi thêm coalUnit. API CTKTKT kiểm lại coalUnit với ô công tơ thực tế, từ chối lượt OCR bị lẫn trước khi ghi. Các lượt lưu báo cáo chung không có coalUnit giữ hành vi cũ để không ảnh hưởng nhập các nhóm số liệu khác; quyền và khóa ngày không thay đổi.
- 19 test liên quan đạt, gồm phân loại 1D1/2D1, không lách qua đổi đích, cảnh báo batch trộn, đổi tổ xóa xác nhận và chặn request lẫn ô S1/S2 trước khi gửi. Toàn bộ bộ test, TypeScript trong build Webpack và ESLint các file logic sửa đều đạt. Không lưu số vận hành thật khi thử UI.
- Production **e9ee7a1** triển khai thành công: chọn S2 rồi tải ảnh máy cấp S1 đã được cho phép, Gemini vẫn nhận đúng nhãn gốc; banner khác tổ xuất hiện, checkbox đối chiếu và nút lưu bị khóa. Không xác nhận/lưu số vận hành. Sửa lời hướng dẫn khi chưa có ảnh để yêu cầu ảnh đúng tổ, tránh dòng hướng dẫn cũ mời tải lẫn hai tổ. Ảnh bằng chứng lưu local ngoài Git.

# 2026-10-26 — Sắp thứ tự ảnh công tơ theo bảng báo cáo

- Dùng chung `compareCoalMeterOrder`: S1 rồi S2; trong mỗi tổ A1, A2, B1, B2, C1, C2, D1, D2, E1, E2, F1, F2; cùng công tơ theo 08h, 16h, 24h. Ảnh chưa xác định máy cấp xếp cuối; cùng công tơ/ca giữ thứ tự gốc để không che ảnh trùng.
- Áp dụng cho danh sách ảnh đang đọc, bảng xác nhận dưới ảnh, ảnh đã lưu trong cửa sổ nhập và danh sách đối chiếu TKĐ. Sắp bản hiển thị, không đổi thứ tự hàng nguồn hoặc ID; dấu xác nhận và ảnh đang chọn vẫn gắn đúng ảnh khi OCR hoàn tất/đổi công tơ. Danh sách TKĐ xét cả công tơ/ca đối chiếu đã chọn tay.
- 17 test liên quan đạt, bao gồm ảnh tải lộn thứ tự, ca, mã chưa rõ, ảnh trùng và xác nhận đúng ID sau sắp. ESLint các file sửa đạt. Không ghi số liệu vận hành thật.
- Bản dựng production Webpack và TypeScript đạt. Lần chạy trong quyền hạn chế gặp EPERM khi tạo thư mục .next; chạy lại với quyền tạo tệp đầy đủ đạt. Khi sửa máy/ca đối chiếu, giữ nguyên ảnh đang chọn dù vị trí danh sách thay đổi.

# 2026-10-26 — Tải dữ liệu theo đợt, kiểm tra ghi và rà soát phân quyền

- CTKTKT: tải ngày/D-1 trước (4 truy vấn, bỏ giờ năm ở bước đầu), tiếp tục ngữ cảnh đầu tháng cho tồn kho và giờ QLKT riêng. Gộp ngữ cảnh không đè D/D-1 đang nhập. Có trạng thái tải, hủy lượt cũ khi đổi ngày, chặn xuất khi chưa đủ dữ liệu; giữ dữ liệu khi lỗi. Cửa sổ ảnh/mail/đối chiếu tải mã khi mở, giữ ảnh khi đóng/mở lại.
- Thêm GET scope=stored đúng một ngày: chỉ đọc số nhập với 1 truy vấn để xác minh sau lưu thông thường và OCR, không tính lại liên kết/giờ năm. Scope=operating-hours chỉ làm phần lũy kế. Các scope mới vẫn yêu cầu phiên hợp lệ và no-store.
- PMIS/PPA tải từng tháng trong khoảng chọn, giới hạn từ/đến theo tháng; giữ D-1 của CTKTKT để phép tính chênh lệch đúng. Hủy lượt cũ, chặn kết quả cũ ghi đè. Không tính giờ năm trong luồng phân tích; scope=non-ktkt ở daily-inputs bỏ dữ liệu KTKT nhận trùng. BCSX dùng hai nhóm tối đa hai yêu cầu đồng thời thay bốn lượt tuần tự.
- Máy chủ CTKTKT chặn ngày không tồn tại, ô trùng và từ chối cả lượt có ô ngoài quyền; giữ giao dịch nhật ký và readback trước thành công. Giao diện đồng bộ PMIS trước đây cho người có quyền nhóm khác bật nút; đã yêu cầu đúng quyền pmis_reports. Chính sách xem báo cáo chung của tài khoản đăng nhập không đổi, không tự thêm quyền cho tài khoản.
- Các phép thử mới kiểm API SQLite, dữ liệu sau ghép các đợt, số truy vấn, phạm vi ngày, hủy lượt tháng, thu hồi quyền và từ chối ghi trực tiếp ngoài nhóm. Tài liệu kiến trúc, ma trận quyền và giới hạn đo: docs/DATA-LOADING-AND-PERMISSIONS.md. Không ghi/sửa số vận hành thật để kiểm tra.
- Phân trang bảng PMIS/PPA tối đa 30 ngày trong DOM, không cắt nguồn biểu đồ/tổng hợp/Excel. PPA giữ mới nhất trước, PMIS giữ thứ tự cột ngày; trang đầu/trang cuối/rỗng và ghép mọi trang đủ dữ liệu có test riêng. Toàn bộ test đạt; bản dựng production Webpack/TypeScript đạt, ESLint không lỗi (còn hai cảnh báo cũ dùng location.assign cho tải Excel).
- Production aff8730: Vercel báo triển khai thành công. Tab kiểm tra riêng xác nhận báo cáo ngày tải xong, bật xuất sau khi đủ dữ liệu, tab công tơ hiện số và cửa sổ ảnh lazy-load mở được. PMIS chọn 01/09–25/10 (55 ngày): trang 1 có 30 cột ngày, trang 2 có 25; không báo lỗi. PPA chọn Tất cả tải được 86 ngày, trang 1 hiện 1–30, trang 2 hiện 31–60. Không gửi đồng bộ, upload ảnh hoặc lưu số liệu thật; đã đóng tab kiểm tra. Ảnh minh chứng phân trang lưu local ngoài Git.
