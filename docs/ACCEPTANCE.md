# Trạng thái bản kiểm thử PXVH1 — 12/09/2026

## Phạm vi đã triển khai

Nhập trực tiếp số liệu tổng tháng cho 7 chỉ tiêu. Máy chủ tự tính, lưu kết quả, ngưỡng tham khảo, thời gian và dữ liệu đầu vào trong ghi chú có tiền tố phiên bản. Mỗi lần ghi là một phiên bản mới; tổng quan chọn lần mới nhất cho từng chỉ tiêu/kỳ. Không có dữ liệu mẫu tự gán là dữ liệu thực. Chưa có luồng nhập từng ngày, cộng dồn nhiều kỳ, phân quyền nhiều người hay phê duyệt/chốt kỳ.

## Công thức và nguồn đối chiếu

Nguồn: sổ theo dõi PXVH1 người dùng cung cấp, sheet `theo dõi CTKTKT`.

| Chỉ tiêu | Công thức phần mềm | Cơ sở nguồn |
| --- | --- | --- |
| Bi nghiền | kg bi × 1000 / tấn than | B13 = B9 × 1000 / B11 |
| NH3 | kg sử dụng × 1000 / kWh xuất tuyến | B29 = B25 / B4; cần xác nhận đơn vị và ý nghĩa B25 |
| Điện tự dùng | (kWh đầu cực − kWh xuất tuyến) / kWh đầu cực × 100 | B17+B18 và B4; B41/B42 theo tổ máy |
| Mỡ bánh răng | kg × 1000 / kWh xuất tuyến | B51: kg / (triệu kWh × 1000) |
| NaOH 30%, HCl 31%, PAC lỏng | kg × 1000 / kWh xuất tuyến | B77:B79: tấn / triệu kWh, tương đương g/kWh |

Đổi đơn vị đầu vào: 1 tấn = 1000 kg; 1 triệu kWh = 1000000 kWh. Không tự quy đổi nồng độ hoặc thể tích sang khối lượng. Kỳ phải có mẫu số > 0, khối lượng không âm. Lưu 15 chữ số có nghĩa để tránh nhiễu số thực tại đúng ngưỡng; hiển thị tối đa 4 chữ số thập phân. Chênh lệch nhỏ hơn độ chính xác số thực chưa được hỗ trợ.

## Điểm phải xác nhận trước khi dùng thật

- NH3: B27 ghi định mức đầu cực, bảng cảnh báo lại dùng B29 xuất tuyến. Ô T01!CN5 ghi lượng nhập trong ngày, trong khi B25 ghi lượng tiêu thụ. Phần mềm yêu cầu lượng sử dụng; không coi lượng nhập kho là tiêu hao. Chưa thể xác nhận ngưỡng NH3 là đúng cơ sở.
- HCl: B78 cộng hai SUMIFS chỉ khác chữ hoa/thường, có nguy cơ đếm hai lần. Phần mềm nhận tổng khối lượng một lần, không tái tạo lỗi cộng trùng này.
- NaOH: nguồn cộng cả mục 31% dù tên chỉ tiêu là 30%. Phần mềm chỉ nhận lượng dung dịch 30%; nồng độ khác cần quy tắc được phê duyệt.
- PAC: tên nguồn ghi bột/lỏng nhưng công thức chỉ lọc PAC lỏng. Bản này chỉ tính PAC lỏng.
- Tất cả định mức cần người phê duyệt, ngày hiệu lực, phạm vi và cơ sở điện rõ ràng. Cảnh báo hiện chỉ là tham khảo.
- Trước dữ liệu thật: xác nhận nơi lưu trữ được phép, kiểm soát truy cập, nhật ký người sửa, sao lưu/khôi phục và yêu cầu an toàn thông tin nội bộ. Giao diện thử chưa chứng minh tuân thủ.

## Kiểm tra đã thực hiện

- 5 nhóm kiểm tra tự động: công thức điện, 6 công thức vật tư, số nhập thiếu/sai, kỳ và giới hạn, bằng/vượt ngưỡng: đạt.
- Kiểm tra kiểu dữ liệu mã nguồn: đạt. Đóng gói ứng dụng: đạt.
- Migration được tạo bằng Drizzle; SQL chạy trên SQLite thử trong bộ nhớ: đạt.
- Khởi tạo cơ sở dữ liệu D1 giả lập rỗng trên máy: đạt, không thay đổi dữ liệu từ Excel hay dữ liệu triển khai.
- Trình duyệt tại localhost: nhập điện sản xuất 1000000, xuất tuyến 920200, kết quả 7,98%; lưu thành công, tải lại trang vẫn đọc được kết quả và lịch sử.
- Chưa kiểm tra máy chủ triển khai hoặc vận hành nhiều người. Chưa có phát hành trực tuyến.

## Chạy thử trên máy

Trong thư mục dự án, dùng Node đã cài để chạy:

```text
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config wrangler.local.json
node scripts/run-framework.mjs dev
```

Mở địa chỉ localhost mà chương trình in ra. Không thêm `--remote` vào lệnh dữ liệu thử. Máy hiện tại có thể cần quyền chạy ngoài môi trường hạn chế vì lỗi nhận dạng người dùng của Windows, không phải lỗi công thức.

---

# Bổ sung 15/09/2026 — Suất hao nhiệt PPA và đồng bộ QLKT bằng một nút

Phần này do Codex xây dựng và được Claude tiếp nhận, rà soát lại, chạy kiểm thử để xác nhận trước khi bàn giao tiếp.

## Suất hao nhiệt PPA (trang `/ppa-heat-rate`)

Tính suất hao nhiệt theo hợp đồng PPA (công thức nội suy theo dải tải, suy giảm ~0,09%/năm từ gốc 2016) cho S1, S2 và toàn nhà máy, dựa trên 4 điểm đo công tơ giao nhận điện (`DHA_S1`, `DH1_285M`, `DHA_S2`, `DH1_283M`) với đủ 48 chu kỳ nửa giờ mỗi điểm. So sánh với suất hao nhiệt thực tế tính từ số liệu than/nhiệt trị/điện đã nhập ở bảng chỉ tiêu tháng, cho kết luận Đạt/Vượt PPA theo từng phạm vi (chung, S1, S2), lưu kèm ghi chú nguyên nhân và lịch sử theo ngày trong tháng.

## Đồng bộ QLKT bằng một nút (không cần mở tiện ích thủ công mỗi ngày)

Đã hoàn thiện tiện ích trình duyệt "Đồng bộ QLKT" v0.4.6 (Chrome/Edge, tại `public/qlkt-sync-extension/`, gói tải về tại `/qlkt-sync-extension.zip`) và nối trực tiếp vào cả hai trang:

- **Bảng chỉ tiêu tháng** (trang chủ): nút "Đồng bộ QLKT" gọi tiện ích lấy đồng thời Sản lượng + Nhiên liệu + Vận hành cho ngày đã chọn, đổ vào bảng kiểm tra để chọn số liệu muốn đưa vào trước khi lưu.
- **Trang suất hao nhiệt PPA**: nút "Đồng bộ QLKT" gọi tiện ích lấy riêng màn hình Số liệu đo đếm công tơ (đủ 4 điểm đo, 48 chu kỳ) cho ngày đang xem.

Cơ chế: mỗi trang có một `content script` (`web-bridge.js`) chỉ chạy trên `localhost`/`127.0.0.1`, làm cầu nối `postMessage` giữa trang web và `background.js` của tiện ích (giao thức PING/READY, SYNC_ALL/SYNC_ALL_RESULT, SYNC_PPA/SYNC_PPA_RESULT, có mã yêu cầu và thời gian chờ tối đa). `background.js` tự mở các màn hình QLKT, đặt đúng ngày, đọc giá trị qua `content.js`, rồi đóng tab. Riêng màn hình công tơ dùng địa chỉ cố định `/qlkt/sxd/solieucto.jsf` và được mở thành tab đang hiển thị vì QLKT không dựng đủ dữ liệu `ExtSheet` khi tab chạy nền; sau khi đọc xong tiện ích tự quay lại tab web trước đó. `meter-extract.js` đọc trực tiếp mảng JSON `data` của `PrimeFaces ExtSheet`, không phụ thuộc các hàng/cột đang được bảng ảo hóa hiển thị. Web luôn báo rõ trạng thái kết nối ("Tiện ích vX đã kết nối"/"Chưa kết nối"), khóa nút trong lúc đồng bộ, và báo lỗi rõ ràng khi phiên đăng nhập QLKT hết hạn hoặc phản hồi quá lâu (60–90 giây tuỳ trang). Dữ liệu lấy về luôn qua bảng kiểm tra, không tự ghi vào kho.

## Kiểm tra đã thực hiện cho phần bổ sung này

- Đã đọc lại toàn bộ mã nguồn liên quan (`lib/qlkt-sync.ts`, `lib/ppa-heat-rate.ts`, hai trang web, cả 6 file của tiện ích) để rà soát tính nhất quán giữa các phần — không phát hiện đoạn dở dang, TODO hay hàm giả lập.
- Đã xác nhận trên trang QLKT thật rằng bảng công tơ dùng `PrimeFaces ExtSheet`, dữ liệu đầy đủ nằm trong cấu hình JSON của thẻ `script`, còn DOM chỉ hiển thị một phần hàng/cột.
- Đã bổ sung 2 trường hợp kiểm tra mô phỏng đúng cấu trúc `ExtSheet` thật (tên điểm đo có khoảng trắng đệm và 4 kênh cho mỗi điểm đo). Tổng cộng 23 trường hợp kiểm tra tự động hiện có phải đạt trước khi bàn giao.
- Bản v0.4.4 ưu tiên tái sử dụng tab công tơ do người dùng đã mở qua menu QLKT, vì kiểm tra thực tế cho thấy tab tạo trực tiếp dù `active` vẫn chỉ có 21 thẻ script và không dựng `ExtSheet`. Tiện ích kích hoạt tab đó khi đọc, giữ tab mở và tự quay lại tab web; nếu không tìm thấy mới dùng URL cố định làm phương án dự phòng. Vẫn cần người dùng xác nhận một lần cuối trên phiên đăng nhập QLKT thật trước khi dùng chính thức.
- Bản v0.4.5 tự chèn `meter-extract.js` và `content.js` vào tab QLKT nếu tab đã được mở trước lúc tiện ích Reload, khắc phục lỗi `Could not establish connection. Receiving end does not exist.`.
- Bản v0.4.6 đọc trực tiếp các mảng dữ liệu trong đối tượng widget `PrimeFaces/ExtSheet` bằng `chrome.scripting` ở ngữ cảnh trang QLKT; cách quét thẻ `script` và đọc bảng DOM được giữ làm dự phòng.

## Trạng thái cuối lượt 15/09/2026

- **Đã làm:** nâng tiện ích lên v0.4.6, ưu tiên dùng tab công tơ QLKT đang mở và đọc trực tiếp dữ liệu của widget `PrimeFaces/ExtSheet`; đã đóng gói lại ZIP và nối với nút đồng bộ trên web.
- **Đã kiểm tra:** 23/23 kiểm thử đạt, lint đạt, build đạt và hai thư mục mã tiện ích giống nhau.
- **Còn thiếu:** chưa có xác nhận chạy thành công cuối cùng từ người dùng trên phiên QLKT thật sau khi Reload v0.4.6.
- **Bước tiếp theo:** người dùng Reload tiện ích, giữ tab “Số liệu đo đếm công tơ” đang mở, F5 trang PPA và thử “Đồng bộ QLKT”; nếu lỗi, dùng nguyên thông báo mới để tiếp tục chẩn đoán.

## Trạng thái cuối lượt — cảnh báo CE/CF

- **Đã làm:** bỏ ràng buộc bắt buộc ghi nguyên nhân khi CE/CF tăng bất thường; thẻ thống kê và dấu hiệu cảnh báo vẫn được hiển thị, nhưng người dùng có thể lưu dữ liệu không cần ghi chú.
- **Còn thiếu:** cần người dùng F5 trang và xác nhận nút “Lưu thay đổi” không còn bị chặn đối với các ngày CE/CF đang cảnh báo.

## Trạng thái cuối lượt — bàn giao Git

- **Đã làm:** kiểm tra working tree sạch trên nhánh `main` và chuẩn bị đẩy mã để bàn giao cho người phát triển tiếp theo.
- **Còn thiếu:** chưa push được vì `origin` hiện trỏ tới remote nội bộ `git.chatgpt-team.site`, máy chưa có phiên xác thực cho remote này và chưa có URL kho GitHub đích.
- **Bước tiếp theo:** người dùng cung cấp URL kho GitHub đã tạo hoặc đăng nhập lại remote hiện tại trên máy; không gửi mật khẩu hay token trong cuộc trò chuyện.
- **Thử lại:** lệnh `git fetch origin` tiếp tục trả về `Authentication required`; trong dự án không tìm thấy remote GitHub dự phòng, nên chưa thể push an toàn khi chưa có URL kho đích hoặc phiên đăng nhập hợp lệ.
- **GitHub đích:** ảnh người dùng cung cấp là kho `ngocyenspkt1-create/duyen-hai-1-hrm-eam`, thuộc dự án HRM/EAM khác; chưa push dashboard KTKT vào kho này để tránh trộn hai mã nguồn. Còn thiếu URL một kho GitHub riêng cho `ctktkt-dashboard`.
- **Bàn giao GitHub:** đã thêm remote `github` trỏ tới `ngocyenspkt1-create/ctktkt-dashboard` và push nhánh `main` thành công. Remote nội bộ `origin` được giữ nguyên; máy cục bộ hiện theo dõi `github/main`.
- **Gói cài tiện ích:** đã xác minh `public/qlkt-sync-extension.zip` khớp hoàn toàn với mã nguồn `browser-extension/qlkt-sync`, manifest phiên bản `0.4.6`; kiểm thử đồng bộ công tơ đạt 5/5. SHA-256 của gói: `1728F39FA63E6F10176705E2C084328FDF57642B6843F715A62305912746BB69`. Người dùng cần giải nén trước rồi chọn thư mục đã giải nén bằng `Load unpacked` trên Chrome/Edge.

---

# Bổ sung 16/09/2026 — Báo cáo PMIS, đồng bộ 2 tổ máy 1 nút, đồng bộ theo khoảng ngày

## Đã làm

- **Trang "Báo cáo PMIS" (`/pmis-report`)**: hiển thị theo đúng khuôn mẫu "THEO PMIS" của người dùng — chọn khoảng ngày tuỳ ý, mỗi tổ máy (S1-DH1/S2-DH1) có 5 chỉ tiêu: 4 chỉ tiêu mới lấy từ QLKT (Trung bình công suất đầu cực, Tổn thất khói khô trung bình, Trung bình chân không bình ngưng, Trung bình nhiệt độ nước làm mát tuần hoàn — lưu vào mã dùng chung `DA`–`DH`) và 1 chỉ tiêu tính lại từ công thức NH3 đầu cực đã có (`BQ/B`, `BR/H`). Đã thêm mục điều hướng "Báo cáo PMIS" thay cho mục cũ.
- **Đọc đúng dữ liệu QLKT màn hình "Cân bằng nhiệt"**: đã trực tiếp kiểm tra DOM thật trên máy người dùng (Claude in Chrome, phiên đăng nhập của người dùng, không nhập mật khẩu) để sửa lại thuật toán đọc cột "Trung bình" — bảng PrimeFaces có cột đóng băng thực chất là 2 `<table>` tách rời cùng chỉ số hàng, cộng thêm 1 bảng "chỉ có dòng tiêu đề" giả để giữ cố định khi cuộn (phải chọn bảng có nhiều hàng nhất). Đã khớp đúng theo "Ký hiệu" (`PG`/`L1`/`Pbn`/`T`) thay vì dò nhãn tiếng Việt, xác nhận đúng số liệu thật cho cả 2 tổ máy.
- **Đồng bộ 2 tổ máy trong 1 lần bấm**: `content.js` tự phát hiện dropdown "Tổ máy" (không khoá cứng id), đọc tổ máy đang chọn, tự chuyển sang tổ máy còn lại, chờ bảng nạp lại (so sánh nội dung cột "Trung bình" trước/sau vì AJAX không có sự kiện "load" rõ ràng), đọc tiếp, rồi tự trả lại đúng tổ máy ban đầu. `background.js` có `syncHeatRate()`/`SYNC_HEATRATE_QLKT`, `web-bridge.js` dịch `SYNC_HEATRATE` ↔ `SYNC_HEATRATE_QLKT`/`_RESULT`, web gọi đúng loại thông điệp mới (trước đó bị lỗi kiến trúc: nút web gọi nhầm `SYNC_ALL`, chỉ nút "Chỉ lấy trang đang mở" của tiện ích mới thực sự chạy đúng). Tiện ích lên bản `0.4.8`.
- **Đồng bộ theo khoảng ngày**: thêm khối "Đồng bộ nhiều ngày" trên trang PMIS — chọn Từ ngày/Đến ngày (tối đa 62 ngày/lần), tự lặp qua từng ngày, gọi lại đúng luồng "1 ngày · 2 tổ máy" ở trên rồi **tự lưu thẳng** vào kho dữ liệu cho từng ngày (không hỏi xác nhận từng ngày vì có thể tới vài chục ngày), có thanh tiến trình và nút "Dừng" giữa chừng, báo tổng kết số ngày lưu được/lỗi khi xong.

## Kiểm tra đã thực hiện

- `npx tsc --noEmit`: đạt (không lỗi mới).
- `npm run lint`: các lỗi hiện có là lỗi nền có từ trước (react-hooks/refs ở `daily-production-table.tsx`, react-hooks/set-state-in-effect ở `pmis-report.tsx` dòng đầu hiệu ứng đọc hash và ở `ppa-heat-rate-comparison.tsx`, 2 cảnh báo biến không dùng trong `background.js`) — không có lỗi lint mới phát sinh từ các thay đổi lần này.
- `npm run build`: đạt, dựng đủ cả route `/pmis-report`.
- Đã xác minh trực tiếp trên dữ liệu QLKT thật (đăng nhập của người dùng) rằng thuật toán đọc "Ký hiệu"/"Trung bình" đúng cho cả `DH1_MF1` và `DH1_MF2` trước khi viết lại thành bản đọc-cả-2-tổ-máy.

## Còn thiếu / chưa xác nhận được

- **Chưa kiểm chứng trực tiếp trên hệ thống QLKT thật** phần tự động chuyển đổi dropdown "Tổ máy" + chờ AJAX nạp lại + khôi phục tổ máy ban đầu (`findMainAssetSelect`, `switchHeatRateUnit`) — phần đọc từng tổ máy riêng lẻ đã kiểm chứng, nhưng phần tự-chuyển-qua-lại thì chưa, vì không còn phiên trình duyệt đang đăng nhập QLKT của người dùng tại thời điểm viết. Cần người dùng thử thật và báo lỗi cụ thể nếu có (đặc biệt: dropdown có khôi phục đúng tổ máy ban đầu không, việc đổi dropdown trong tab chạy nền — `background:false` — có hoạt động ổn định như tab đang xem hay không).
- **Đồng bộ theo khoảng ngày lưu thẳng không qua bảng xem trước** — khác với nút đồng bộ 1 ngày (luôn qua bảng kiểm tra trước khi lưu). Đây là lựa chọn có chủ đích để tránh vài chục hộp thoại xác nhận, nhưng người dùng cần biết trước khi bấm: dữ liệu cũ của các ngày đó (nếu có) sẽ bị ghi đè ngay, không có bước "xem lại rồi mới lưu".
- **Sự cố đồng bộ file lên máy người dùng**: có 1 lần `device_commit_files` báo thành công nhưng file thực tế trên máy không đổi (do gián đoạn kết nối tạm thời đúng lúc đó) — đã phát hiện và ghi đè lại đúng, đã xác minh lại bằng cách tải file từ máy về kiểm tra nội dung. Nên nhớ: báo "written" từ công cụ đồng bộ không phải lúc nào cũng nghĩa là file trên máy đã đổi, nhất là quanh thời điểm mất kết nối — nếu người dùng báo "chưa thấy thay đổi", nên tải lại file thật từ máy để đối chiếu trước khi đoán nguyên nhân khác.
- **Câu hỏi cũ chưa có câu trả lời**: ô "Địa chỉ web Chỉ tiêu KTKT" trong popup tiện ích vẫn để mặc định `http://localhost:5173/`. Người dùng xác nhận đang chạy `npm run dev` + mở `localhost:5173` (không phải địa chỉ đã triển khai thật), nên hiện tại giá trị mặc định này là đúng cho quy trình hằng ngày của người dùng — không cần đổi trừ khi sau này triển khai lên một địa chỉ web thật khác.
- Chưa kiểm thử tự động (không có bộ test riêng cho `content.js`/`background.js` của tiện ích — các file này không chạy qua Vitest/Jest, chỉ được kiểm chứng thủ công qua Claude in Chrome trên dữ liệu thật).

---

# Bổ sung 16/09/2026 (tiếp) — Bố cục lại bảng PMIS + biểu đồ theo ngày

## Đã làm

- **Thu hẹp cột nhãn chỉ tiêu** từ 220px xuống 150px (đủ chứa nhãn dài nhất xuống 3 dòng).
- **Đóng băng 5 cột ngày đầu**: bảng tách làm 2 `<table>` đặt cạnh nhau — bảng trái (nhãn + 5 ngày đầu) đứng yên, bảng phải (các ngày còn lại) cuộn ngang riêng trong vùng của nó, cùng kiểu "cột đóng băng" như chính màn hình QLKT dùng (PrimeFaces). Cả 2 bảng dùng chung hằng số chiều cao hàng cố định (`HEADER_ROW_H`/`BAND_ROW_H`/`METRIC_ROW_H`) để không bị lệch hàng — đây đúng là lỗi tương tự đã gặp và sửa ở phía đọc dữ liệu QLKT, nay tự áp dụng lại cho bảng của chính mình. Đã dựng thử bằng Playwright ở nhiều kích thước màn hình (700px, 1100px, 1280px, 1600px) và cuộn thử vùng bên phải để xác nhận 2 bảng luôn khớp hàng.
- **Cột ngày rộng 56px** — đủ hẹp để một màn hình rộng vừa phải (khoảng ≥1150px, sau khi trừ menu bên trái) hiển thị được ít nhất 12 ngày cùng lúc không cần cuộn; màn hình hẹp hơn vẫn xem đủ nhờ cuộn vùng bên phải, 5 ngày đầu luôn cố định.
- **Biểu đồ theo ngày**: thêm 5 ô biểu đồ đường (1 ô/chỉ tiêu, vì mỗi chỉ tiêu 1 đơn vị đo khác nhau nên không gộp chung 1 trục) hiển thị dưới bảng, mỗi ô có 2 đường S1 (xanh dương `#2f6fb0`)/S2 (hổ phách `#b9860f`) — dùng đúng cặp màu tổ máy đã có sẵn ở trang "So sánh SHN PPA & thực tế" để nhất quán giữa các trang, dùng thư viện `recharts` đã có sẵn trong dự án.
- **Đưa khối "Đồng bộ nhiều ngày" lên trên** khối "Từ ngày/Đến ngày" (xem báo cáo), thu gọn padding 2 khối để nhường không gian cho bảng + biểu đồ; bỏ luôn dòng cảnh báo cũ "hãy đổi Tổ máy trên QLKT rồi đồng bộ lần lượt" (không còn đúng từ khi có bản đồng bộ 2 tổ máy 1 nút).

## Kiểm tra đã thực hiện

- `npx tsc --noEmit`, `npm run lint` (chỉ còn đúng lỗi nền cũ dòng hiệu ứng đọc hash), `npm run build`: đều đạt.
- Dựng `npm run dev` trong sandbox, dùng Playwright chụp ảnh và cuộn thử trực tiếp ở 4 kích thước màn hình khác nhau để xác nhận bảng không bị lệch hàng và vẫn giữ đúng cột đóng băng — không chỉ đọc code mà đã nhìn thấy kết quả hiển thị thật trước khi bàn giao.

## Còn thiếu / cần lưu ý

- Biểu đồ hiện trống vì môi trường sandbox không có dữ liệu D1 thật — cần người dùng tự xem trên dữ liệu thật của họ để xác nhận biểu đồ hiển thị đúng khi có số liệu (đường nối liền/đứt đoạn ở ngày thiếu số liệu, trục tự co giãn theo giá trị).
- "Ít nhất 12 ngày không cần cuộn" chỉ đúng ở màn hình đủ rộng (ước tính ≥1150px sau khi trừ menu) — trên máy tính xách tay màn nhỏ hoặc cửa sổ trình duyệt thu hẹp, vẫn xem được đủ nhưng phải cuộn phần bên phải; 5 ngày đầu luôn cố định trong mọi trường hợp.

---

# Bổ sung 16/09/2026 (tiếp #2) — Gộp thanh công cụ 1 hàng, lấp đầy bảng, biểu đồ theo tổ máy, cố gắng vừa 1 trang

## Đã làm

- **Gộp 2 khối điều khiển thành đúng 1 hàng** trên cùng (xem báo cáo + đồng bộ 1 ngày + đồng bộ nhiều ngày đều trên 1 hàng, tự xuống dòng khi màn hình hẹp).
- **Bảng lấp đầy hết chiều rộng còn trống**: cột ngày ở phần cuộn không còn khoá cứng bề rộng (chỉ giữ bề rộng tối thiểu), bảng đặt `width:100%` nên khi ít ngày các cột tự giãn ra lấp đầy, không còn để trống mảng lớn bên phải như trước; khi nhiều ngày vượt quá khung nhìn, cột vẫn giữ đủ rộng để đọc số và sinh thanh cuộn ngang bình thường.
- **Nhãn chỉ tiêu rút còn 1 dòng** (cắt bớt bằng `truncate`, xem đầy đủ khi rê chuột) thay vì xuống dòng 2-3 dòng như trước — để hàng bảng thấp lại đáng kể, dồn không gian cho biểu đồ.
- **Biểu đồ đổi bố cục theo đúng yêu cầu mới**: 2 khối (1 khối/tổ máy) thay vì 5 khối theo từng chỉ tiêu như bản trước; mỗi khối tổ máy gộp đủ cả 5 chỉ tiêu, hiển thị thành 5 ô nhỏ xếp 1 hàng bên trong khối đó. Không gộp 5 chỉ tiêu vào chung 1 trục (vì 5 đơn vị đo khác nhau — làm vậy sẽ vẽ sai lệch, đường gần như phẳng), mỗi ô vẫn giữ đúng 1 trục riêng, chỉ tô theo màu tổ máy.
- **Cố gắng vừa 1 trang, hạn chế cuộn dọc**: chiều cao cả trang đặt tối thiểu bằng chiều cao khung nhìn trừ phần header (`min-h-[calc(100vh-88px)]`), bảng giữ chiều cao cố định gọn, phần biểu đồ giãn lấp phần còn lại. Đã đặt biểu đồ có chiều cao tối thiểu (không cho co nhỏ tới mức không đọc được) — vì vậy khi thanh công cụ phải xuống 2 dòng (màn hình hẹp hơn ~1400px), tổng nội dung có thể nhỉnh hơn khung nhìn vài chục đến ~150px và trang sẽ cuộn dọc một chút; đây là đánh đổi có chủ đích để biểu đồ không bị bóp méo tới mức vô dụng.

## Kiểm tra đã thực hiện

- `npx tsc --noEmit`, `npm run lint` (chỉ còn lỗi nền cũ), `npm run build`: đều đạt.
- Dựng `npm run dev`, dùng Playwright chụp ảnh ở 4 kích thước màn hình phổ biến (1280×720, 1366×768, 1600×900, 1920×1080): ở 1600×900 trở lên (khớp với màn hình thật của người dùng qua ảnh chụp họ gửi) toàn bộ trang — thanh công cụ, bảng, 2 khối biểu đồ — vừa đúng 1 khung nhìn, không cần cuộn dọc; ở 2 độ phân giải hẹp hơn (1280×720, 1366×768) thanh công cụ xuống 2 dòng và trang cuộn dọc thêm một khoảng ngắn, biểu đồ vẫn hiển thị rõ ràng, không bị bóp méo.

## Còn thiếu / cần lưu ý

- Ngưỡng "1 trang không cuộn" ước tính cho chiều rộng cửa sổ trình duyệt khoảng ≥1500-1600px trở lên; cửa sổ hẹp hơn (laptop nhỏ, chia đôi màn hình) sẽ có cuộn dọc nhẹ — đã kiểm chứng đây là mức cuộn nhỏ (dưới ~150px), không phải toàn bộ trang.
- Đã bỏ dòng cảnh báo màu vàng cũ ("hãy đổi Tổ máy trên QLKT rồi đồng bộ lần lượt") để tiết kiệm chỗ — thông tin đó đã lỗi thời từ khi có bản đồng bộ 2 tổ máy 1 nút nên bỏ không ảnh hưởng.
---
# Bổ sung 16/09/2026 (tiếp #3) — Sửa lỗi bảng chọn ngày trong suốt, gộp 5 chỉ tiêu vào chung 1 biểu đồ/tổ máy
## Lỗi đã sửa
- Bảng chọn ngày (DateField/Calendar, dùng ở tất cả các ô "Từ ngày/Đến ngày/Ngày đồng bộ") bị trong
  suốt, chữ số của bảng dữ liệu phía sau lộ ra đè lên lịch, không đọc được. Nguyên nhân: các class
  Tailwind kiểu `bg-popover`, `text-muted-foreground`, `bg-primary`, `bg-accent`... mà shadcn/ui
  dùng chưa từng được định nghĩa biến CSS tương ứng (`--popover`, `--primary`...) trong
  `app/globals.css` — nên toàn bộ các class này âm thầm không sinh ra CSS gì (không lỗi, không
  cảnh báo), khiến khung lịch không có nền. Đã bổ sung đầy đủ bộ biến màu chuẩn của shadcn (nền,
  chữ, viền, màu nhấn...) vào `app/globals.css`, đồng thời set thẳng `bg-white` cho khung lịch trong
  `components/ui/date-field.tsx` để chắc chắn luôn có nền trắng dù sau này theme đổi. Lỗi này ảnh
  hưởng tiềm ẩn tới mọi popover/dialog khác dùng các class trên trong toàn bộ ứng dụng, không riêng
  trang PMIS — nên sửa ở gốc (globals.css) thay vì chỉ vá riêng 1 chỗ.
- Biểu đồ trước đó vẫn còn chia nhỏ theo từng chỉ tiêu (5 ô nhỏ/tổ máy) dù đã gộp vào 1 khối — chưa
  đúng ý "gộp cả 5 thông số vào chung 1 biểu đồ". Đã sửa: mỗi tổ máy giờ chỉ còn ĐÚNG 1 biểu đồ, có
  5 đường (1 đường/chỉ tiêu), có chú giải (legend) màu cố định theo chỉ tiêu ở dưới mỗi biểu đồ.
  Vì 5 chỉ tiêu có đơn vị đo khác nhau (MW/%/kPa/°C/g·kWh⁻¹) nên không thể vẽ chung true theo giá
  trị gốc (chỉ tiêu giá trị lớn sẽ "đè phẳng" chỉ tiêu giá trị nhỏ) — đã quy đổi mỗi đường về "chỉ số
  tương đối" so với giá trị đầu kỳ của chính chỉ tiêu đó (ngày đầu tiên có số liệu = 100), nên vẫn 1
  trục Y duy nhất nhưng xem được xu hướng tăng/giảm của cả 5 chỉ tiêu cùng lúc; giá trị gốc đúng đơn
  vị vẫn hiển thị đầy đủ khi rê chuột vào biểu đồ (tooltip).
## Kiểm tra đã thực hiện
- `tsc --noEmit` đạt (không còn lỗi kiểu dữ liệu của phần tooltip/legend mới).
- Playwright: mở bảng chọn ngày ở ô "Từ ngày" tại 1600×900 — xác nhận nền trắng, chữ rõ, không còn
  đè lên bảng dữ liệu phía sau; xác nhận khu vực biểu đồ chỉ còn đúng 2 khối (S1, S2), mỗi khối có
  chú giải 5 màu tương ứng 5 chỉ tiêu.
- Đã đẩy `components/pmis-report.tsx`, `components/ui/date-field.tsx`, `app/globals.css` sang máy
  người dùng và xác minh lại đúng số byte đã ghi thành công (kể cả sau khi phải gửi lại 2 lần do
  hiện tượng "báo ghi thành công nhưng chưa cập nhật thật" như các lần trước).
## Còn thiếu / cần lưu ý
- Chưa kiểm tra trực quan với dữ liệu thật (sandbox không có dữ liệu D1) — biểu đồ mới chỉ được xác
  minh về mặt cấu trúc (đúng 2 khối, đúng 5 đường, tooltip/legend hiển thị đúng nhãn), chưa xác nhận
  hình dạng đường với số liệu thực tế của người dùng.
- Bộ biến màu shadcn mới thêm dùng theo bảng màu mặc định (chưa tuỳ biến theo thương hiệu riêng);
  nếu sau này cần đổi màu chủ đạo của toàn bộ nút bấm/hộp thoại thì sửa ở khối `:root`/`@theme
  inline` mới thêm trong `app/globals.css`.
---
# Bổ sung 16/09/2026 (tiếp #4) — Bỏ ô tìm kiếm, đổi tên trang, biểu đồ cạnh nhau + khoảng ngày riêng
## Đã làm
- Bỏ ô tìm kiếm ở đầu trang (chỉ trên trang Báo cáo PMIS — thêm prop `hideSearch` cho `AppShell`,
  các trang khác dùng chung `AppShell` vẫn giữ nguyên ô tìm kiếm).
- Đổi tiêu đề trang: bỏ 2 dòng "BÁO CÁO LẤY TỪ QLKT" / "Báo cáo THEO PMIS", chỉ còn 1 dòng "Bảng
  thông số tổn thất khói".
- Biểu đồ: đổi bố cục từ xếp chồng (S1 trên, S2 dưới) sang đặt cạnh nhau (S1 trái, S2 phải); tăng
  độ đậm nét vẽ (strokeWidth 2→3) và đổi sang bảng màu bão hòa hơn cho từng chỉ tiêu; nới biên trục Y
  (`dataMin - 5` / `dataMax + 5`) để các đường không bị bó sát viền, dễ phân biệt hơn.
- Thêm khoảng ngày riêng cho biểu đồ (độc lập với khoảng ngày của bảng phía trên) — mặc định trùng
  bảng, có nút "Áp dụng" riêng. Dữ liệu tải về (`loadRange`) giờ luôn gộp đủ các tháng cho CẢ khoảng
  ngày của bảng lẫn của biểu đồ trong 1 lần gọi (`reloadForBothRanges`), nên đổi 1 trong 2 khoảng
  không làm mất dữ liệu của khoảng còn lại.
## Kiểm tra đã thực hiện
- `tsc --noEmit` đạt.
- Playwright tại 1600×900: xác nhận không còn ô tìm kiếm, tiêu đề đúng 1 dòng, khối chọn khoảng ngày
  biểu đồ hiển thị đúng vị trí (trên biểu đồ, dưới bảng), 2 biểu đồ nằm cạnh nhau S1/S2.
- Đã đẩy `components/pmis-report.tsx`, `components/app-shell.tsx`, `app/pmis-report/page.tsx` sang
  máy người dùng và xác minh lại đúng số byte (pmis-report.tsx phải gửi lại 1 lần do hiện tượng cũ).
## Còn thiếu / cần lưu ý
- Chưa xem được hình dạng đường thật với dữ liệu thật (sandbox không có dữ liệu D1).
---
# Bổ sung 16/09/2026 (tiếp #5) — Trục Y riêng cho từng chỉ tiêu trong biểu đồ, bỏ đóng băng cột ngày
## Đã làm
- Biểu đồ: bỏ cách "quy về chỉ số tương đối" (vì domain vẫn tính chung nên chỉ tiêu biên độ nhỏ như
  PBN vẫn nhìn phẳng). Đổi sang: mỗi chỉ tiêu có 1 trục Y RIÊNG (ẩn, không hiện số/đường trục) chỉ để
  tự tính tỷ lệ hiển thị cho đúng đường của nó — vẫn 1 biểu đồ, 1 trục X (ngày) chung như yêu cầu,
  nhưng mỗi đường được co giãn theo đúng biên độ dao động thật của chỉ tiêu đó nên luôn thấy rõ thay
  đổi, không còn bị "đè phẳng" bởi chỉ tiêu có giá trị lớn hơn nhiều. Tooltip vẫn hiện đúng giá trị
  gốc theo đơn vị của từng chỉ tiêu.
- "Trung bình công suất đầu cực" (PG): đổi màu đỏ, khoảng hiển thị trục Y cố định 400–625 MW theo
  đúng yêu cầu.
- Các chỉ tiêu còn lại: khoảng hiển thị tự tính theo min/max thực tế trong khoảng ngày đang xem,
  cộng đệm 12% (tối thiểu 1 đơn vị) mỗi bên — không cần đặt cứng từng chỉ tiêu.
- Bỏ đóng băng 5 ngày đầu ở bảng số liệu: gộp lại thành 1 bảng duy nhất, cuộn ngang khi nhiều ngày;
  cột nhãn chỉ tiêu vẫn đứng yên bên trái khi cuộn (dùng `sticky`, không cần tách 2 bảng như trước).
## Kiểm tra đã thực hiện
- `tsc --noEmit` đạt (phải thêm `AxisDomainItem` từ `recharts/types/util/types` để domain theo hàm
  min/max có kiểu đúng).
- Đã nạp dữ liệu mẫu vào CSDL sandbox (chỉ trong máy chủ mô phỏng, không đụng dữ liệu thật của người
  dùng) để xác nhận trực quan bằng Playwright: cả 5 đường đều thấy rõ dao động, đường PG (đỏ) đúng
  khoảng 400–625, bảng hiển thị đủ cả 10 ngày trong 1 bảng không còn tách rời.
- Đã đẩy `components/pmis-report.tsx` sang máy người dùng và xác minh lại đúng số byte đã ghi (phải
  gửi lại 1 lần do hiện tượng cũ).
## Còn thiếu / cần lưu ý
- Khoảng đệm 12% cho các chỉ tiêu còn lại là số mặc định hợp lý chung — nếu muốn khoảng cố định
  riêng cho chỉ tiêu nào khác (như đã làm với PG), chỉ cần thêm vào `METRIC_DOMAIN` trong
  `components/pmis-report.tsx`.
---
# Bổ sung 16/09/2026 (tiếp #6) — Thêm lưới ngang nét đứt mờ trong biểu đồ
## Đã làm
- Thêm đường lưới ngang (gạch nét đứt, màu mờ `#c9d2e0`) trải đều theo chiều cao mỗi biểu đồ để dễ
  so sánh mức cao/thấp giữa các đường — tắt hẳn lưới dọc (chỉ giữ lưới ngang) cho đỡ rối mắt.
- Sự cố kỹ thuật gặp phải: vì mỗi chỉ tiêu giờ có 1 trục Y riêng (`yAxisId` khác nhau, xem bổ sung
  tiếp #5), `CartesianGrid` mặc định tìm trục có `yAxisId="0"` để lấy vạch chia — không khớp trục nào
  trong 5 trục đã đặt tên riêng, nên chỉ vẽ được đúng 1 vạch. Đã sửa bằng cách chỉ định rõ
  `yAxisId="PG"` cho `CartesianGrid` để nó lấy đúng vạch chia của 1 trục cụ thể làm lưới ngang.
## Kiểm tra đã thực hiện
- `tsc --noEmit` đạt.
- Playwright + dữ liệu mẫu (sandbox, không đụng dữ liệu thật): xác nhận cả 2 biểu đồ đều hiện nhiều
  vạch lưới ngang nét đứt mờ trải đều, không còn tình trạng chỉ có 1 vạch.
- Đã đẩy `components/pmis-report.tsx` sang máy người dùng, xác minh lại đúng số byte (gửi lại 1 lần
  do hiện tượng "báo thành công nhưng chưa cập nhật" như các lần trước).
---
# Trạng thái cuối lượt — bàn giao Codex (16/09/2026)

Phần này tóm tắt lại toàn bộ trạng thái hiện tại của trang "Báo cáo PMIS" (`/pmis-report`) sau nhiều lượt chỉnh sửa liên tiếp trong ngày 16/09/2026 (các mục "Bổ sung 16/09/2026" và "(tiếp #1..#6)" ở trên là nhật ký chi tiết theo từng lượt) — để Codex không cần đọc lại toàn bộ lịch sử mà vẫn nắm được trạng thái cuối cùng.

## File liên quan

- `components/pmis-report.tsx` — toàn bộ trang, gồm cả bảng số liệu và biểu đồ.
- `components/ui/date-field.tsx` — ô chọn ngày dùng chung toàn app (đã sửa lỗi nền trong suốt, xem tiếp #3).
- `components/app-shell.tsx` — khung layout dùng chung, có thêm prop `hideSearch` cho riêng trang PMIS (tiếp #4).
- `app/pmis-report/page.tsx` — trang gọi `AppShell` với `hideSearch`.
- `app/globals.css` — đã bổ sung bộ biến màu chuẩn shadcn/ui còn thiếu (`--popover`, `--primary`...), ảnh hưởng chung toàn app, không riêng trang PMIS.
- `public/qlkt-sync-extension/` (+ bản zip `public/qlkt-sync-extension.zip`) — tiện ích trình duyệt đồng bộ QLKT, hiện ở bản `0.4.8`, có luồng `SYNC_HEATRATE` riêng cho trang PMIS (đọc đồng thời cả S1 và S2 trong 1 lần bấm).

## Trạng thái hiện tại của trang PMIS

**Bảng số liệu**: 1 bảng duy nhất (đã bỏ kiểu "đóng băng 5 cột đầu / 2 bảng tách rời" — xem tiếp #5), cuộn ngang khi nhiều ngày, cột nhãn chỉ tiêu dùng `sticky left-0` để luôn đứng yên bên trái khi cuộn. Tiêu đề trang chỉ còn 1 dòng "Bảng thông số tổn thất khói" (tiếp #4). Không còn ô tìm kiếm ở header (chỉ ẩn riêng trang này qua `hideSearch`, các trang khác không đổi).

**Toolbar**: gộp thành 1 hàng trên cùng gồm 3 nhóm — xem báo cáo theo khoảng ngày (Từ ngày/Đến ngày + Áp dụng), đồng bộ 1 ngày từ QLKT, đồng bộ nhiều ngày từ QLKT (tự lưu thẳng, tối đa 62 ngày/lần, có thanh tiến trình + nút Dừng).

**Biểu đồ**: đúng 2 biểu đồ đặt cạnh nhau (S1 trái, S2 phải — tiếp #4), mỗi biểu đồ gộp chung cả 5 chỉ tiêu theo giá trị gốc (không quy đổi chỉ số tương đối nữa — đã bỏ cách đó ở tiếp #5 vì vẫn bị đè phẳng). Mỗi chỉ tiêu có 1 trục Y ẩn riêng (`yAxisId` = mã chỉ tiêu: `PG`/`L1`/`PBN`/`TNM`/`NH3`) để tự co giãn theo đúng biên độ của chính nó — xem hàm `domainFor()` trong `pmis-report.tsx`. Riêng "Trung bình công suất đầu cực" (PG) cố định khoảng trục 400–625 MW và tô màu đỏ theo yêu cầu người dùng; các chỉ tiêu còn lại tự tính khoảng theo min/max thực tế + đệm 12%. Có lưới ngang nét đứt màu mờ trải đều theo chiều cao biểu đồ để dễ so sánh (tiếp #6) — lưu ý kỹ thuật: `CartesianGrid` phải được gán `yAxisId="PG"` tường minh thì mới lấy đúng vạch chia, vì mặc định nó tìm trục `yAxisId="0"` không khớp trục nào trong 5 trục đã đặt tên riêng. Biểu đồ có khoảng ngày xem riêng, độc lập với khoảng ngày của bảng phía trên (đặt mặc định trùng nhau, có nút Áp dụng riêng) — dữ liệu tải về luôn gộp đủ tháng cho cả 2 khoảng cùng lúc (`reloadForBothRanges()`), tránh mất dữ liệu khi đổi 1 trong 2 khoảng.

## Đã kiểm tra

- `npx tsc --noEmit`, `npm run build`: đạt ở mọi lượt.
- Đã dựng `npm run dev` trong sandbox và dùng Playwright chụp ảnh nhiều lần trong ngày để xác nhận trực quan (không chỉ đọc code): bảng chọn ngày có nền, bảng số liệu không còn tách rời, biểu đồ đúng bố cục 2 khối cạnh nhau, các đường đều thấy rõ dao động, lưới ngang hiện đều.
- Có 1 lượt đã nạp dữ liệu mẫu vào CSDL D1 của sandbox (chỉ trong máy chủ mô phỏng cục bộ, không đụng dữ liệu thật của người dùng) để xác nhận hình dạng đường biểu đồ thật thay vì chỉ xác nhận cấu trúc rỗng.

## Còn thiếu / Codex cần lưu ý khi tiếp nhận

- **Chưa xác nhận trên dữ liệu thật của người dùng** — mọi xác nhận trực quan về biểu đồ (trừ 1 lần) đều dựa trên bảng trống hoặc dữ liệu mẫu tự tạo trong sandbox, chưa phải số liệu QLKT thật của người dùng.
- **Phần tự động chuyển đổi dropdown "Tổ máy" trên QLKT thật** (`findMainAssetSelect`, `switchHeatRateUnit` trong `content.js`) — chỉ mới kiểm chứng từng tổ máy đọc riêng lẻ trên dữ liệu thật, phần tự-chuyển-qua-lại-rồi-khôi-phục chưa được người dùng xác nhận chạy thật trên QLKT (xem chi tiết ở mục "Bổ sung 16/09/2026" phía trên).
- **Đồng bộ theo khoảng ngày lưu thẳng, không qua bảng xem trước** — là lựa chọn có chủ đích, nhưng ghi đè ngay dữ liệu cũ của các ngày đó nếu có.
- **Khoảng đệm 12% cho trục Y** của các chỉ tiêu (trừ PG) là giá trị mặc định chung, chưa tinh chỉnh riêng theo từng chỉ tiêu — nếu người dùng thấy đường nào vẫn chưa đủ rõ, chỉnh trong `METRIC_DOMAIN`/`domainFor()`.
- **Bộ biến màu shadcn thêm vào `app/globals.css`** dùng theo bảng màu mặc định (chưa theo thương hiệu riêng của công ty) — ảnh hưởng toàn app chứ không riêng trang PMIS, nên khi đổi cần kiểm tra rộng hơn phạm vi trang này.
- **Hiện tượng đồng bộ file lên máy người dùng không ổn định** (không liên quan Codex nếu làm việc trực tiếp trên máy/qua Git, chỉ liên quan cách Claude đẩy file qua cầu nối thiết bị) — ghi lại để tránh nhầm lẫn nếu thấy nhắc tới trong các mục "Bổ sung" phía trên.

---

# Bổ sung 17/09/2026 — Đẩy dữ liệu Chỉ tiêu lên Google Sheet DH1

## Đã làm

- Thêm nút **“Đẩy Google Sheet”** tại trang Dữ liệu các tháng, dùng chung ngày đang chọn ở ô “Ngày đồng bộ”.
- Lần đầu trên mỗi máy, người dùng nhập URL Apps Script và mã kết nối; hai giá trị chỉ lưu trong trình duyệt, không ghi vào mã nguồn/GitHub và mã kết nối không đi qua API của web Chỉ tiêu.
- Thêm bước xem trước và xác nhận trước khi ghi. Dữ liệu được ánh xạ sang ba nhóm S1, S2 và NMNĐ gồm sản lượng, công suất bình quân, suất hao than, nhiệt trị, SHN thực tế, SHN PPA, chênh lệch và đánh giá.
- Giữ nguyên các cột nhập thủ công trên Google Sheet: tình hình vận hành, chỉ đạo và công suất khả dụng. Web chỉ xác định đúng hàng theo ngày rồi cập nhật các cột tính toán đã cấu hình trong Apps Script.
- Kiểm tra API xem trước bằng dữ liệu thật ngày 13/09/2026: S1 `10,69696` triệu kWh, S2 `10,69244` triệu kWh, NMNĐ `21.389,4` MWh.

## Kiểm tra đã thực hiện

- `node --test tests/*.mjs`: đạt 27/27 kiểm thử.
- `npx tsc --noEmit`: đạt.
- ESLint riêng các file mới: đạt. Lint toàn kho vẫn còn lỗi cũ tại `daily-production-table.tsx`, `pmis-report.tsx` và `ppa-heat-rate-comparison.tsx`, không phát sinh từ logic Google Sheet.
- `npm run build`: đạt; route `/api/google-sheet-sync` có trong bản dựng.
- Kiểm tra trực quan trên `http://localhost:5173/`: nút “Đẩy Google Sheet” và nút thiết lập hiển thị đúng trên thanh công cụ.

## Còn thiếu / cần người dùng xác nhận

- Chưa thực hiện lần ghi thật cuối cùng vì thao tác đó sẽ thay đổi Google Sheet báo cáo. Người dùng cần thiết lập URL/mã kết nối, chọn một ngày, xem trước rồi bấm “Xác nhận đẩy lên Sheet”.
- Nếu Apps Script báo từ chối, cần kiểm tra lại đúng URL bản triển khai `/exec`, mã kết nối và quyền truy cập của bản triển khai; không cần cung cấp mật khẩu Google cho web.

## Bổ sung giao diện 17/09/2026

- Làm nổi bật ô chọn ngày bằng khung xanh và đổi nhãn thành **“NGÀY CẦN ĐỒNG BỘ / ĐẨY SHEET”**.
- Nút Google Sheet hiển thị luôn ngày sẽ ghi, ví dụ **“Đẩy Google Sheet · 13/09/2026”**, để tránh chọn nhầm ngày.

## Điều chỉnh vị trí đồng bộ Google Sheet 17/09/2026

- Đã bỏ nút Google Sheet khỏi trang **Dữ liệu các tháng**; ô ngày tại đây chỉ còn phục vụ **Đồng bộ QLKT**.
- Đã chuyển ô **Ngày đẩy Google Sheet**, nút đẩy và nút thiết lập sang tab **So sánh trực quan SHN Thực tế và PPA**. Khi mở trang, hệ thống tự chọn ngày có kết quả PPA đã lưu gần nhất trong khoảng đang xem.
- Nút đẩy bị khóa nếu ngày chọn chưa có kết quả PPA đã lưu; người dùng phải nhập/đồng bộ dữ liệu ngày và lưu kết quả PPA trước.
- Đã đạt `node --test tests/*.mjs` (27/27), `npx tsc --noEmit` và `npm run build`.
- Còn thiếu: lượt kiểm tra trực quan cuối bị người dùng dừng giữa chừng; chưa thực hiện ghi thật lên Google Sheet để tránh thay đổi báo cáo khi chưa có xác nhận.
