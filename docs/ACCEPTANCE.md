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

# Bổ sung 20/09/2026 — Đồng bộ công thức CTKTKT với Excel gốc

- Đã sửa dầu tiêu thụ theo đúng Excel: `(F1 hiện tại - F1 mốc trước) - (F2 hiện tại - F2 mốc trước)`; kỳ 06h dùng mốc 24h ngày D-1.
- Đã thay mô hình than/SHN rút gọn bằng chuỗi công thức Excel: chênh lệch cân + ô hiệu chỉnh, trộn Sub-bitum, quy ẩm 8,5%, nhiệt trị chung nhà máy và SHN S1/S2.
- Đã đồng bộ công thức NH3 giữa giao diện và báo cáo email; các phép tính hơi, TKĐ DCS và PMIS đã được kiểm tra lại theo ô nguồn.
- Đối chiếu ngày 17/09/2026 khớp các kết quả khóa của Excel gốc: than quy ẩm S1 `5341.11098688518 t`, S2 `5349.81764480845 t`; nhiệt trị `20021.5934392878 kJ/kg`; SHN S1 `10569.4584381209`, S2 `10611.2296030078 kJ/kWh`; sáu kỳ dầu và hơi khớp tới sai số số thực.
- Kiểm tra kỹ thuật: 79/79 test, TypeScript, lint, build và kiểm tra whitespace trên các file thuộc phạm vi sửa đều đạt. Không đưa thay đổi một dòng trống có sẵn trong `docs/HANDOFF_CODEX_2026_09_19.md` vào commit.
- Nghiệm thu còn thiếu: thử một ngày vận hành thật khác 17/09 có than trộn/hiệu chỉnh cân, so sánh màn hình và file Excel xuất lại trước khi phát hành làm báo cáo chính thức.

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
# Module mới: Nhập liệu BCSX — Giai đoạn 1 (17/09/2026)

## Bối cảnh

Người dùng gửi 5 file Excel thật (CHỈ TIÊU KINH TẾ KỸ THUẬT + 3 file BCSX_NMD A0/S1/S2 + BẢNG THEO DÕI NƯỚC) và yêu cầu: đọc kỹ để đề xuất đưa việc nhập liệu lên web, giữ nguyên công thức gốc, phần nào lấy được từ QLKT thì tự đồng bộ, cuối cùng xuất lại đúng file gốc để trưởng ca gửi mail — không đổi quy trình phía nhận (NSMO/lãnh đạo phân xưởng).

Đã publish phân tích chi tiết vào Project claude.ai "chỉ tiêu kinh tế kỹ thuật DH1" (`claude/phan-tich-de-xuat-nhap-lieu-ktkt.md`). Người dùng xác nhận qua AskUserQuestion: (1) file `[2]` (chất lượng than/tro xỉ) tạm bỏ qua, vẫn nhập tay; (2) bảng P/Q nửa giờ trong BCSX là trưởng ca gõ tay từng điểm, không có nguồn tự động; (3) làm Giai đoạn 1 trước — form nhập công tơ + xuất file BCSX.

## Đã đọc kỹ cấu trúc thật (không đoán) — bằng openpyxl trên file người dùng gửi

- File CHỈ TIÊU: khối "Bảng ghi công tơ" (cột M-R cho S1 giờ 6/10/14/18/22/24, cột AG-AL cho S2) là nơi nhập tay P/Q, dầu, nước, mực bồn... theo giờ; khối nhãn cột V/AF (than 12 công tơ/tổ máy A1-F2, công tơ máy phát/MBT/tự dùng...) đọc theo lịch riêng: một số mốc 6/8/14/16/22/24h (điện), một số 6/14/22/24h (than) — **lịch đọc không đều giữa các nhóm công tơ**, đã xác nhận bằng dữ liệu thật chứ không suy đoán.
- File BCSX_NMD (mỗi unit 1 file, 16 sheet = 16 ngày): mỗi sheet gồm đúng 3 khối cần nhập tay — (a) bảng 48 điểm nửa giờ (00:30→23:59) × 4 cột (P đầu cực, Q, P điểm bán, điện áp thanh cái), hàng 11-58, cột A-E; (b) 5 số tổng cuối ngày ở C60:C64 (đầu cực/thương phẩm/tự dùng/than tiêu thụ/than tồn kho); (c) nhật ký sự kiện vận hành hàng 72 trở đi (bắt đầu/kết thúc/loại 1-5/mô tả).
- **Đã xác nhận A0 = S1 + S2 theo từng ô** (ví dụ B11: A0=876=438+438, C60: A0=23195.72≈11605.08+S2), nghĩa là **file A0 không cần nhập riêng, tính tự động** từ S1+S2 (trừ cột điện áp thanh cái — giữ theo S1; "than tồn kho" là số toàn nhà máy, không cộng đôi).
- **Đã xác nhận trùng lặp thật**: C60 (Sản lượng đầu cực S1, BCSX) = J157 (khối PMIS, file CHỈ TIÊU) = 11605.08 — cùng 1 số, đang gõ tay 2 nơi. 3/5 số tổng (đầu cực, thương phẩm, than tiêu thụ) trùng đúng với các mã QLKT-sync **đã có sẵn** trong hệ thống (`B`/`C`/`AE` cho S1, `H`/`I`/`AF` cho S2, `AR` cho than tồn kho — xem `lib/qlkt-sync.ts`), và đã có UI nhập/đồng bộ sẵn ở trang "/" (`daily-production-table.tsx`). "Tự dùng" = đầu cực − thương phẩm (tính, không cần nhập).

## Đã làm (Giai đoạn 1 — form nhập công tơ + xuất file BCSX)

Phạm vi chọn cho giai đoạn 1: đúng phần người dùng chọn ưu tiên — **KHÔNG** đụng tới file CHỈ TIÊU (đó là giai đoạn 3), chỉ tập trung dữ liệu BCSX cần cho 3 file A0/S1/S2.

- **CSDL** (`db/schema.ts`, migration `drizzle/0003_smooth_trish_tilby.sql`): 2 bảng mới —
  - `shift_readings` (operating_date, unit, time_slot, metric, value) — 48 mốc giờ × 4 thông số (P/Q/D/E) × 2 tổ máy/ngày.
  - `operating_events` (operating_date, unit, start_at, end_at, event_type, description) — nhật ký sự kiện, ghi đè toàn bộ theo (ngày, tổ máy) mỗi lần lưu (đơn giản, phù hợp vì chỉ 1 người nhập/ngày).
- **API**: `app/api/shift-readings/route.ts` (GET/POST), `app/api/operating-events/route.ts` (GET/POST, POST thay toàn bộ danh sách theo ngày+tổ máy), `app/api/bcsx-export/route.ts` (GET, trả file .xlsx) — theo đúng khuôn mẫu validate/allowedCodes như `daily-inputs/route.ts` đã có.
- **Xuất file**: `lib/bcsx.ts` dùng thư viện `exceljs` (đã thêm vào `package.json`), nạp file mẫu (template) rỗng đã tách sẵn cho từng tổ máy, điền đúng ô cần điền, giữ nguyên toàn bộ công thức/định dạng còn lại — **không tự viết lại file bằng tay**, nên không có rủi ro sai định dạng.
  - Template gốc: `assets/bcsx-templates/bcsx-{s1,s2,a0}-template.xlsx` — tách ra từ chính sheet "16" (ngày 16/09/2026) của 3 file người dùng gửi, chỉ xóa các ô nhập tay (48 điểm, 5 số tổng, nhật ký sự kiện), giữ nguyên mọi công thức/style/merge cell khác.
  - Vì Cloudflare Workers không có filesystem lúc chạy, base64 hóa cả 3 template thành `lib/bcsx-templates.generated.ts` (sinh tự động bằng `scripts/gen-bcsx-templates.mjs` — chạy lại script này nếu cần sửa template).
  - Đã xác nhận `exceljs` đọc/ghi/roundtrip đúng trong môi trường `nodejs_compat` của Workers (test cục bộ bằng Node trước, sau đó test qua API thật của app).
- **Giao diện**: trang mới `/bcsx-report` (`components/bcsx-report.tsx`, menu "Nhập liệu BCSX" trong `app-shell.tsx`) gồm 4 phần: (1) bảng 48 điểm nửa giờ theo tổ máy đang chọn (tab S1/S2), (2) hiển thị trạng thái đã đủ/thiếu số liệu PMIS tổng ngày (đọc từ `daily_inputs` có sẵn, dẫn link sang trang "/" nếu thiếu — **không nhập trùng lần 2**), (3) nhật ký sự kiện (thêm/xóa dòng, lưu theo tổ máy), (4) 3 nút xuất file BCSX_NMD_A0/S1/S2.

## Đã kiểm tra

- `npx tsc --noEmit`: sạch. `npx eslint` trên toàn bộ file mới: sạch (đã sửa 2 lỗi ban đầu — `<a>` → `next/link`, và kiểu `any` khi import `exceljs` động).
- Áp migration `0003` vào D1 cục bộ (`wrangler d1 execute ... --file drizzle/0003_....sql`), test trực tiếp cả 3 API bằng `curl`: lưu 48-điểm, lưu sự kiện, lưu số liệu PMIS mẫu vào `daily_inputs`, rồi xuất thử cả 3 file (S1/A0/kiểm tra tổ máy không hợp lệ trả lỗi đúng).
- Mở file .xlsx xuất ra bằng `openpyxl`, xác nhận đúng từng ô: A11/B11/C11/D11/E11 (giờ + 4 thông số), C60-C64 (5 số tổng, đúng bằng số liệu thật của ngày 16/09/2026 đã seed vào `daily_inputs`), A72-D72 (dòng sự kiện), và **font/style ô tiêu đề vẫn giữ nguyên** (kiểm `B9.font.bold == True`).
- Dựng `npm run dev`, dùng Playwright: xác nhận trang render đúng bố cục, đổi ngày qua lịch load đúng dữ liệu đã lưu, badge "Đã có đủ số liệu PMIS..." hiện đúng khi đã có `B/C/AE` cho ngày đó, nút xuất file tải file `.xlsx` về đúng tên `BCSX_NMD_S1_17.09.2026.xlsx`.

## Còn thiếu / bước tiếp theo (chưa làm trong lượt này)

- **Chưa xuất được file CHỈ TIÊU KINH TẾ KỸ THUẬT** (đó là Giai đoạn 3 theo đề xuất đã chốt) — bảng tính này còn nhiều khối công thức phức tạp hơn nhiều (suất hao nhiệt, quy đổi VCF dầu, PMIS…), cần làm riêng và có khả năng cần xác nhận thêm với người dùng về từng công thức trước khi tự động hóa.
- **Chưa mở rộng đồng bộ QLKT cho các mã PMIS còn thiếu** (Giai đoạn 2) — hiện chỉ tái dùng đúng các mã đã có sẵn (B/C/AE/H/I/AF/AR), chưa thêm mã mới nào vào `qlktFieldLabels`.
- **Chưa làm form nước bổ sung theo ca** (Giai đoạn 4, file `BẢNG THEO DÕI LƯỢNG NƯỚC...`) — vẫn nhập trực tiếp trong Excel như cũ.
- **48 điểm nửa giờ vẫn phải gõ tay** (đúng theo xác nhận của người dùng — QLKT/DCS chưa có nguồn xuất), chỉ chuyển từ gõ trong Excel sang gõ trên web + validate ngay, chưa giảm được số lượng phải gõ. Có thể cân nhắc thêm sau: nút "sao chép giá trị dòng trên" cho các điểm ít biến động, nếu người dùng thấy vẫn mất thời gian.
- **Chưa thử trên số liệu thật của người dùng** — mọi xác nhận trong lượt này dùng dữ liệu mẫu tự nhập vào D1 cục bộ của sandbox (không đụng dữ liệu thật), khớp đúng với các số liệu có sẵn trong file mẫu ngày 16/09/2026 người dùng gửi (dùng làm "đáp án" để so sánh) — nhưng người dùng nên tự nhập thử 1 ngày thật và so sánh file xuất ra với file đang làm tay trước khi dùng chính thức.
- **File export là 1 sheet/ngày độc lập** (đặt tên `BCSX_NMD_<unit>_<dd.mm.yyyy>.xlsx`), **không tự nối vào workbook nhiều sheet của cả tháng** như cách trưởng ca đang làm (copy sheet ngày hôm trước, đổi tên) — nếu người dùng cần giữ đúng thói quen 1 file/tháng nhiều sheet, cần làm thêm bước "chèn sheet vào file tháng đang có" (phức tạp hơn vì phải tự tăng số sheet và không được phép ghi đè sheet cũ).

---
# Điều chỉnh Giai đoạn 1 theo làm rõ của người dùng (17/09/2026, tiếp)

Người dùng làm rõ thêm 4 điểm sau khi thấy bản đầu; đã sửa code theo đúng yêu cầu:

1. **Mục "1. Thông số vận hành" (48 điểm nửa giờ) của S1/S2 luôn nhập tay** — xác nhận đúng thiết kế ban đầu, không đổi.
2. **5 số tổng ngày (đầu cực/thương phẩm/tự dùng/than tiêu thụ/than tồn kho) lấy từ QLKT đồng bộ** — người dùng sẽ chỉ vị trí chính xác trên QLKT sau; **đã đổi UI mục 2 từ "chỉ hiển thị trạng thái + link sang trang khác" thành 4 ô nhập trực tiếp ngay tại trang này** (dùng chung đúng 4 mã field code đã có sẵn `B/C/AE` cho S1, `H/I/AF` cho S2, `AR` dùng chung — cùng 1 chỗ lưu với trang "Dữ liệu các tháng", nên nhập ở đâu cũng ra cùng 1 số). Đang chờ người dùng chỉ rõ màn hình QLKT để nối nút "Đồng bộ" riêng cho trang này (hiện chưa có nút đồng bộ riêng, chỉ có ô nhập tay).
3. **"Tình hình vận hành" (nhật ký sự kiện) cũng lấy từ QLKT** — trước đó code hiểu nhầm là chỉ nhập tay. Đã sửa lại nhãn mục 3 ghi rõ "sẽ đồng bộ trực tiếp từ QLKT khi có vị trí cụ thể — hiện nhập tay tạm thời". Chưa nối đồng bộ thật (chưa có vị trí QLKT), UI nhập tay vẫn giữ nguyên làm phương án tạm/ghi đè.
4. **File A0 — đã sửa đúng 3 quy tắc người dùng nêu**:
   - Mục 1 (48 điểm): tổng S1+S2 tại **từng ô kể cả cột điện áp thanh cái** (trước đó code chỉ lấy theo S1 cho cột điện áp — đã bỏ ngoại lệ này).
   - Mục 2 (5 số tổng): tổng S1+S2 cho đầu cực/thương phẩm/than tiêu thụ. **Riêng than tồn kho: đang giữ nguyên KHÔNG cộng đôi** (không sửa theo yêu cầu chung "tổng S1+S2"), vì bằng chứng từ chính file thật 16/09/2026 người dùng gửi cho thấy than tồn kho là 1 số toàn nhà máy dùng chung (C64 ở cả S1 và A0 đều = 200076.77, không phải tổng 2 tổ máy cộng lại) — **cần người dùng xác nhận lại xem than tồn kho có nên cộng đôi hay không trước khi đổi**, vì nếu cộng nhầm sẽ sai số liệu gửi NSMO.
   - Mục 3 (nhật ký sự kiện): các dòng của **S1 đứng trước, S2 tiếp theo sau** — không sắp xếp lại theo thời gian (trước đó code sắp xếp gộp theo thời gian, đã bỏ).

Đã kiểm tra lại bằng dữ liệu mẫu: cột điện áp A0 = tổng đúng 2 tổ máy, thứ tự sự kiện A0 đúng S1 trước/S2 sau (không theo giờ), số tổng ngày cộng đúng. `tsc`/`eslint` sạch.

**Đã chốt (17/09/2026)**: người dùng xác nhận than tồn kho ở A0 là 1 kho dùng chung cho cả nhà máy, KHÔNG cộng đôi S1+S2 — giữ nguyên đúng theo code hiện tại, không cần sửa gì thêm. Đã dọn lại ghi chú "TODO" trong `lib/bcsx.ts` và `app/api/bcsx-export/route.ts` cho khỏi để trạng thái "đang chờ xác nhận" nữa.

---
# Bổ sung 17/09/2026 — Hiển thị nhận xét S1/S2 và làm rõ thiết lập Google Sheet

## Đã làm

- Tách cột `Nhận xét` ở bảng chi tiết trang `/ppa-heat-rate` thành hai cột riêng `Nhận xét S1` và `Nhận xét S2`; hiển thị nguyên văn, giữ xuống dòng và tự ngắt dòng dài.
- Thu hẹp cột ngày, các cột số liệu và badge trạng thái; dành 280 px cho mỗi cột nhận xét để xem được nhiều nội dung hơn.
- Hộp thiết lập Google Sheet ghi rõ Apps Script URL phải kết thúc bằng `/exec`, cảnh báo không dán link `docs.google.com/spreadsheets/...`, và giải thích mã kết nối là Token riêng của công cụ chứ không phải mật khẩu Google.
- Kiểm tra URL ngay trước khi lưu; URL sai được báo ngay trong hộp thiết lập và không ghi vào bộ nhớ trình duyệt.

## Kiểm tra đã thực hiện

- `node --test tests/*.mjs`: đạt 29/29.
- `npx.cmd tsc --noEmit`: đạt.
- ESLint riêng `components/google-sheet-sync-button.tsx` và `components/ppa-heat-rate-dashboard.tsx`: đạt.
- `npm.cmd run build`: đạt.
- Kiểm tra trực quan trên localhost: nút Google Sheet vẫn ở trang So sánh trực quan; hộp thiết lập hiện đúng hướng dẫn; bảng có đủ hai cột `Nhận xét S1`/`Nhận xét S2`.

## Còn thiếu

- Các dòng đang hiện dấu `—` cho đến khi triển khai lại Apps Script có nhánh `readAssessments` và bấm `Nhập đánh giá cũ` để nạp nội dung lịch sử về web.
- Chưa ghi thử lên Google Sheet thật trong lượt này để tránh thay đổi báo cáo khi người dùng chưa xác nhận.

---
# Bổ sung 17/09/2026 — QLKT v0.4.9 chờ nút cập nhật ngày

## Đã làm

- Sửa lỗi khi đồng bộ PPA báo `Không tìm thấy nút cập nhật ngày trên màn hình QLKT`: tiện ích không dừng ngay sau lần dò đầu mà chờ widget QLKT dựng xong và thử lại tối đa khoảng 10 giây.
- Giữ trạng thái đang chờ cập nhật sau khi đã đổi ô ngày, tránh lần thử kế tiếp hiểu nhầm rằng ngày đã được tải chỉ vì giá trị trong ô đã thay đổi.
- Mở rộng nhận diện nút PrimeFaces theo biểu tượng/lớp `refresh`, `arrowrefresh`, `arrowreturn`, `circle-arrow`, nhãn `Làm mới`, `Cập nhật`, `Tải lại` và vùng lân cận bên phải ô ngày; loại trừ nút lịch, ghi, xuất và xóa.
- Thông báo lỗi cuối có thêm số nút đang hiển thị để chẩn đoán nếu QLKT tiếp tục thay đổi giao diện.
- Đồng bộ hai bản `browser-extension/qlkt-sync` và `public/qlkt-sync-extension`, tăng phiên bản lên `0.4.9`, đóng gói lại `public/qlkt-sync-extension.zip`.

## Kiểm tra đã thực hiện

- `node --check` cho `content.js` và `background.js`: đạt.
- `node --test tests/*.mjs`: đạt 30/30; có kiểm tra phiên bản 0.4.9 và ba file phát hành quan trọng giống bản nguồn.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- Hai thư mục tiện ích giống nhau đủ 9/9 file; ZIP chứa `manifest.json` ngay thư mục gốc.

## Còn thiếu / bước tiếp theo

- Chưa thể xác nhận lần đồng bộ thật ngày 15/09/2026 vì cần phiên đăng nhập QLKT trên trình duyệt của người dùng.
- Người dùng cần vào trang quản lý tiện ích, bấm `Reload` cho tiện ích, xác nhận phiên bản `0.4.9`, quay lại web và bấm `Đồng bộ QLKT` lần nữa. Nếu vẫn lỗi, gửi nguyên thông báo mới có phần `đã thấy ... nút` để tiếp tục đối chiếu DOM thật.

---
# Bổ sung 17/09/2026 — QLKT v0.4.10 chờ widget nạp đúng ngày

## Đã làm

- Sau bản 0.4.9, người dùng thử đồng bộ lại và vẫn báo lỗi, nhưng là lỗi KHÁC: `readMeterFromPageWorld` (cách đọc chính, lấy thẳng dữ liệu từ widget PrimeFaces trong bộ nhớ trang) chỉ đọc **một lần** ngay sau khi bấm nút làm mới ngày, trong khi QLKT nạp lại bảng ExtSheet bằng AJAX phía máy chủ và có thể mất vài giây. Kết quả: đọc trúng lúc widget còn giữ dữ liệu CỦA NGÀY CŨ (ví dụ chọn `15/09/2026` nhưng widget vẫn trả `16/09/2026`), báo lỗi "Không tìm thấy DHA_S1/kWhGiao cho ngày đã chọn" rồi rơi xuống cách đọc dự phòng (dò `<script>` tĩnh) vốn luôn thất bại trên QLKT hiện tại vì dữ liệu không còn nhúng sẵn trong HTML nữa (đúng như log nhận được: `0 thẻ có "ExtSheet"`).
- Thêm `readMeterFromPageWorldWithRetry()`: thử lại việc đọc widget tối đa 30 lần, cách nhau 1 giây (~30 giây), giống hệt cơ chế `readValuesWithRetry()` đã dùng cho các màn hình khác — chỉ dừng khi đọc được đúng 4 điểm đo của đúng ngày đã chọn.
- Giảm số lần thử của cách đọc dự phòng (`readValuesWithRetry`) từ 40×700ms xuống 5×500ms cho nguồn `meter`, vì cách này gần như chắc chắn không còn tác dụng và chỉ nên giữ lại như một lần thử vét cuối, tránh người dùng phải chờ thêm ~28 giây vô ích trước khi thấy lỗi.
- Đồng bộ cả ba bản `browser-extension/qlkt-sync`, `public/qlkt-sync-extension`, `dist/client/qlkt-sync-extension`, tăng phiên bản lên `0.4.10`, đóng gói lại hai file `qlkt-sync-extension.zip`.

## Kiểm tra đã thực hiện

- `node --check` cho `background.js` và `content.js`: đạt.
- `node --test tests/*.mjs`: đạt 30/30, gồm kiểm tra phiên bản `0.4.10`, sự tồn tại của `readMeterFromPageWorldWithRetry` và ba file phát hành giống bản nguồn.

## Còn thiếu / bước tiếp theo

- Chưa thể xác nhận lần đồng bộ thật trên trình duyệt vì cần phiên đăng nhập QLKT của người dùng.
- Người dùng cần vào trang quản lý tiện ích (`chrome://extensions`), bấm `Reload` cho tiện ích "Đồng bộ QLKT sang Chỉ tiêu KTKT", xác nhận phiên bản đã lên `0.4.10`, rồi quay lại web bấm `Đồng bộ QLKT` lần nữa. Lần đồng bộ này có thể mất tới ~30 giây khi QLKT cần đổi ngày — đây là bình thường, không phải bị treo.

---
# Bổ sung 17/09/2026 — QLKT v0.4.11 sửa lỗi bỏ qua bấm nút cập nhật khi tái sử dụng tab

## Đã làm

- Người dùng lên `0.4.10`, thử lại, **vẫn báo lỗi giống hệt** (widget vẫn trả `16/09/2026` dù chọn `15/09/2026`) — cho thấy 30 giây thử lại ở bản 0.4.10 không giúp được gì, tức đây không đơn thuần là vấn đề chờ chưa đủ lâu.
- Tìm ra nguyên nhân thật ở `content.js`: theo README, tiện ích được thiết kế để **giữ nguyên 1 tab Công tơ PPA mở xuyên suốt nhiều lần đồng bộ** (không mở/đóng tab mới mỗi lần). Hàm `prepareDate()` quyết định có cần bấm lại nút "cập nhật ngày" hay không bằng cách so sánh giá trị ĐANG HIỂN THỊ trong ô ngày với ngày cần đặt — nhưng chính hàm này, ở lần gọi TRƯỚC, đã ghi đè ô ngày thành ngày yêu cầu (`input.value = displayDate`) bất kể cú bấm nút có thực sự làm QLKT nạp lại dữ liệu kịp hay không. Hậu quả: lần đồng bộ THỨ HAI trở đi, ô ngày đã "trông có vẻ đúng" từ trước nên `prepareDate()` tưởng nhầm là không cần bấm nút nữa và bỏ qua hoàn toàn bước làm mới — mọi lần đọc sau đó chỉ đọc dữ liệu cũ còn sót lại trong widget, dù chờ bao lâu cũng không đổi.
- Sửa bằng biến trạng thái riêng `lastPreparedDate` (ngày cuối cùng ĐÃ THỰC SỰ bấm nút cập nhật thành công cho tab này) thay vì dựa vào giá trị hiển thị trong ô ngày để quyết định có cần bấm lại nút hay không. Nút cập nhật giờ luôn được bấm lại mỗi khi ngày yêu cầu khác lần bấm thành công gần nhất, bất kể ô đang hiển thị gì.
- Bổ sung chẩn đoán vào thông báo lỗi (nếu vẫn thất bại): liệt kê toàn bộ giá trị ô ngày đang hiển thị trên trang lúc đọc dữ liệu, và cho biết lần chuẩn bị ngày gần nhất có thực sự bấm nút hay không (kèm mô tả ngắn nút đã bấm) — để có đủ thông tin đối chiếu ngay trong lần báo lỗi tiếp theo nếu cách sửa này chưa dứt điểm được vấn đề.
- Đồng bộ cả ba bản thư mục tiện ích, tăng phiên bản lên `0.4.11`, đóng gói lại hai file `qlkt-sync-extension.zip`.

## Kiểm tra đã thực hiện

- `node --check` cho `background.js` và `content.js`: đạt.
- `node --test tests/*.mjs`: đạt 30/30, gồm kiểm tra phiên bản `0.4.11` và sự tồn tại của `lastPreparedDate`.

## Còn thiếu / bước tiếp theo

- Chưa thể xác nhận lần đồng bộ thật trên trình duyệt vì cần phiên đăng nhập QLKT của người dùng.
- Người dùng cần bấm `Reload` cho tiện ích ở `chrome://extensions`, xác nhận phiên bản đã lên `0.4.11`, rồi bấm `Đồng bộ QLKT` lại. Nếu vẫn lỗi, thông báo lần này sẽ có thêm phần `Ô ngày trên trang: ...` và `Đã bấm nút cập nhật ngày: ...` — gửi nguyên văn để tiếp tục chẩn đoán chính xác nút/luồng nào trên QLKT chưa hoạt động như mong đợi.

---
# Bổ sung 17/09/2026 — QLKT v0.4.12 nới thời gian chờ để tránh timeout phía web

## Đã làm

- Người dùng lên `0.4.11`, bấm Đồng bộ QLKT, lần này web báo `"QLKT phản hồi quá lâu. Hãy kiểm tra phiên đăng nhập QLKT rồi thử lại."` — đây KHÔNG phải lỗi QLKT, mà là đồng hồ đếm ngược 60 giây ở `components/ppa-heat-rate-comparison.tsx` tự bắn ra khi web không thấy tiện ích trả lời kịp, che mất kết quả thật (dù thành công hay báo lỗi cụ thể hơn) mà `background.js` có thể đã/đang tính ra.
- Nguyên nhân: các lần sửa 0.4.10–0.4.11 đã cộng dồn thời gian chờ tối đa của một lượt đồng bộ Công tơ PPA lên tới xấp xỉ chờ nút cập nhật (~10s) + chờ ban đầu (4s) + thử lại đọc widget (30×1s ≈ 30s) + đọc dự phòng (5×0.5s ≈ 2.5s) ≈ 46.5 giây LÝ THUYẾT — chưa kể thời gian thật thi hành mỗi lần đọc (mở tab, `chrome.scripting.executeScript`, `JSON.stringify` bảng dữ liệu lớn để dò trùng lặp) dễ vượt quá 60 giây trên QLKT thật, dù bản thân từng bước đều đúng. Các luồng đồng bộ khác trong cùng web đã có sẵn hạn mức lớn hơn hẳn cho tình huống tương tự (`daily-production-table.tsx`: 90 giây cho 3 màn hình; `pmis-report.tsx`: 120 giây cho màn hình Cân bằng nhiệt) — riêng màn hình Công tơ PPA (được chính code ghi chú là "thường mất nhiều thời gian hơn các màn hình khác") lại đang có hạn mức thấp nhất (60 giây), nên đây là chỗ hụt từ trước, chỉ lộ ra sau khi thêm cơ chế thử lại ở 0.4.10.
- Tăng đồng hồ đếm ngược ở `ppa-heat-rate-comparison.tsx` từ 60 giây lên **90 giây**, khớp với hạn mức của `daily-production-table.tsx`.
- Đổi `readMeterFromPageWorldWithRetry()` từ đếm SỐ LẦN thử cố định sang giới hạn theo THỜI GIAN THỰC (`Date.now()` deadline, mặc định 35 giây) — để tổng thời gian không bị vượt dự tính nếu một lần đọc nào đó (chứ không phải khoảng chờ giữa các lần) bất ngờ chạy lâu hơn bình thường.
- Tăng phiên bản lên `0.4.12`, đồng bộ cả ba bản thư mục tiện ích và đóng gói lại hai file `qlkt-sync-extension.zip`.

## Kiểm tra đã thực hiện

- `node --check` cho `background.js`: đạt.
- `npx tsc --noEmit`: đạt (không lỗi kiểu sau khi đổi mốc thời gian trong file `.tsx`).
- `node --test tests/*.mjs`: đạt 30/30, gồm kiểm tra phiên bản `0.4.12`.

## Còn thiếu / bước tiếp theo

- Chưa thể xác nhận lần đồng bộ thật trên trình duyệt vì cần phiên đăng nhập QLKT của người dùng.
- Người dùng cần làm mới cả hai phía: bấm `Reload` cho tiện ích ở `chrome://extensions` (xác nhận lên `0.4.12`) VÀ tải lại (F5) trang web Chỉ tiêu KTKT để đồng hồ đếm ngược mới (90 giây) trong mã JavaScript của trang có hiệu lực — nếu chỉ reload tiện ích mà không F5 trang web, đồng hồ 60 giây cũ vẫn còn hiệu lực cho tới khi tải lại trang. Lần đồng bộ kế tiếp có thể mất tới ~45–50 giây, đây là bình thường.

---
# Bổ sung 17/09/2026 — QLKT v0.4.13 hỗ trợ website Vercel

## Đã làm

- Cho phép `web-bridge.js` chạy trên đúng miền chính thức `https://ctktkt-dashboard.vercel.app/*`, đồng thời vẫn giữ hỗ trợ localhost để phát triển và kiểm tra.
- Đổi địa chỉ web mặc định trong popup sang `https://ctktkt-dashboard.vercel.app/`. Nếu tiện ích còn giữ đúng địa chỉ localhost mặc định cũ thì popup tự chuyển sang địa chỉ Vercel; địa chỉ tùy chỉnh khác của người dùng vẫn được giữ nguyên.
- Tăng phiên bản tiện ích lên `0.4.13`, đồng bộ bản nguồn/bản phát hành và cập nhật hướng dẫn sử dụng.

## Kiểm tra đã thực hiện

- `node --check` cho `background.js`, `content.js`, `popup.js` và `web-bridge.js`: đạt.
- `node --test tests/*.mjs`: đạt 30/30; có kiểm tra quyền Vercel, địa chỉ mặc định và 9/9 file nguồn/phát hành giống nhau.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- ZIP có đủ 9 file ở thư mục gốc, manifest phiên bản `0.4.13`; SHA-256: `400B2DB7F82290F12575D84F78C293121A72EB5527877D8CD089A81C6BE4C36B`.

## Bước kiểm tra thật còn lại

- Reload tiện ích tại `chrome://extensions`, xác nhận phiên bản `0.4.13`, sau đó F5 trang `https://ctktkt-dashboard.vercel.app/ppa-heat-rate` và kiểm tra trạng thái kết nối trước khi đồng bộ QLKT.

---
# Bổ sung 17/09/2026 — QLKT v0.4.14 giữ ngày đã chuẩn bị khi bộ lọc biến mất

## Hiện tượng và nguyên nhân

- Khi đồng bộ toàn bộ từ website Vercel, web báo `Không xác định được ngày báo cáo trên trang QLKT.`. Kết nối web–tiện ích đã hoạt động; lỗi phát sinh trong bước đọc một màn hình QLKT sau khi bấm cập nhật ngày.
- Mã cũ chỉ xác định ngày từ giá trị các thẻ `input`. Một số màn hình QLKT thay toàn bộ vùng bộ lọc sau khi cập nhật, làm ô ngày biến mất dù dữ liệu báo cáo đã nạp, nên bước đọc mất dấu ngày vừa chuẩn bị.

## Đã sửa

- Lưu ngày đã chuẩn bị vào `sessionStorage` riêng của tab QLKT trước khi bấm cập nhật. Khi ô ngày không còn trong DOM, chỉ dùng ngày này nếu nó trùng chính xác ngày mà web đang yêu cầu; không lấy ngày yêu cầu làm mặc định vô điều kiện.
- Truyền `operatingDate` xuyên suốt đến thông điệp `READ_QLKT_VALUES`, kể cả luồng dự phòng “Chỉ lấy trang đang mở”.
- Nếu vẫn lỗi, thông báo giờ ghi rõ màn hình `Sản lượng`, `Nhiên liệu` hoặc `Vận hành` để chẩn đoán đúng nguồn.
- Tăng phiên bản tiện ích lên `0.4.14`.

## Kiểm tra đã thực hiện

- `node --check` cho các file JavaScript tiện ích: đạt.
- `node --test tests/*.mjs`: đạt 30/30; có kiểm tra hồi quy việc lưu/đối chiếu ngày đã chuẩn bị và truyền ngày vào lệnh đọc.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- ZIP có đủ 9 file ở thư mục gốc, manifest phiên bản `0.4.14`; SHA-256: `BD09617A56DCDB6F7C88D1CA94CE231713B0F06692870BD23CD15A4672EE7DD5`.

## Bước kiểm tra thật còn lại

- Reload tiện ích, xác nhận phiên bản `0.4.14`, F5 website Vercel và chạy lại Đồng bộ QLKT cho ngày đã chọn.

---
# Bổ sung 17/09/2026 — QLKT v0.4.15 đọc bảng Sản lượng tách cột cố định

## Hiện tượng và nguyên nhân

- Sau khi v0.4.14 xử lý được ngày báo cáo, tiện ích báo `Màn hình Sản lượng: Màn hình này chưa có chỉ tiêu nào trong danh sách đồng bộ.`
- Ảnh QLKT thật cho thấy cột `Tổ máy` chứa `DH1_MF1/DH1_MF2` được cố định ở bảng bên trái, còn các ô số `SL phát`, phản kháng, `SL điểm bán` nằm trong bảng cuộn riêng bên phải. Bộ đọc dự phòng cũ chỉ tìm ô số trong cùng hàng DOM với nhãn tổ máy nên nhận hàng rỗng.

## Đã sửa

- Ghép hàng nhãn tổ máy với hàng số liệu bằng vị trí hiển thị theo chiều dọc; dùng chỉ số hàng làm dự phòng khi trình duyệt không trả kích thước phần tử.
- Giữ ánh xạ đúng theo bảng thật: ô số thứ nhất là `SL phát`, ô số thứ ba là `SL điểm bán`; không lấy nhầm cột điện năng phản kháng nằm giữa.
- Nếu vẫn không ghép được, thông báo chẩn đoán mới kèm số bảng và số ô số đã thấy.
- Tăng phiên bản tiện ích lên `0.4.15`.

## Kiểm tra đã thực hiện

- `node --check` cho các file JavaScript tiện ích: đạt.
- `node --test tests/*.mjs`: đạt 30/30; có kiểm tra hồi quy nhánh bảng Sản lượng tách cột.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- ZIP có đủ 9 file ở thư mục gốc, manifest phiên bản `0.4.15`; SHA-256: `6C36DC4F56AC0DEF589B5D3DE7D63EAB7EEC87FA61887A5106CF5B34D9E57E6C`.

## Bước kiểm tra thật còn lại

- Reload tiện ích, xác nhận phiên bản `0.4.15`, F5 website Vercel và chạy lại Đồng bộ QLKT cùng ngày.

---
# Bổ sung 17/09/2026 — QLKT v0.4.16 ghép Sản lượng theo tọa độ hiển thị

## Hiện tượng và nguyên nhân

- v0.4.15 vẫn nhận đúng màn hình Sản lượng nhưng chưa lấy được B/C/H/I, cho thấy vùng ô số bên phải không nằm trong các hàng `<tr>` mà nhánh dự phòng đang quét.

## Đã sửa

- Dò trực tiếp toàn bộ ô số đang hiển thị trên trang, ghép với nhãn `DH1_MF1/DH1_MF2` theo cùng cao độ màn hình và sắp xếp từ trái sang phải; không còn phụ thuộc nhãn và ô số phải nằm trong cùng bảng hoặc cùng hàng DOM.
- Vẫn giữ hai lớp dự phòng cũ: ghép hàng theo tọa độ giữa các bảng, rồi ghép theo chỉ số hàng.
- Thông báo thất bại mới có tiền tố `Bộ đọc v0.4.16` cùng số bảng/số ô số để xác nhận chính xác content script đang chạy.
- Tăng phiên bản tiện ích lên `0.4.16`.

## Kiểm tra đã thực hiện

- `node --check` cho các file JavaScript tiện ích: đạt.
- `node --test tests/*.mjs`: đạt 30/30; có kiểm tra hồi quy nhánh ghép Sản lượng theo tọa độ.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- ZIP có đủ 9 file ở thư mục gốc, manifest phiên bản `0.4.16`; SHA-256: `8BBF9F2A44A7E366CECC4690941B68A895EFBA89CF22E558A14F88928F7EEA65`.

## Bước kiểm tra thật còn lại

- Reload tiện ích, F5 cả trang QLKT và website Vercel, rồi đồng bộ lại. Nếu còn lỗi, gửi nguyên thông báo có tiền tố `Bộ đọc v0.4.16`.

---
# Bổ sung 17/09/2026 — Thu gọn bảng chi tiết PPA theo chiều rộng trang

## Đã làm

- Bỏ chiều rộng tối thiểu 1.480 px của bảng `Bảng chi tiết theo ngày`; phân bổ lại 18 cột theo tỷ lệ phần trăm để bảng vừa chiều rộng khung trang và không cần thanh cuộn ngang.
- Thu gọn cỡ chữ/khoảng đệm; ở màn hình hẹp, ngày hiển thị dạng `dd/MM`, còn màn hình lớn vẫn hiển thị đủ `dd/MM/yyyy`.
- Hai cột `Nhận xét S1` và `Nhận xét S2` mặc định chỉ hiện một dòng. Bấm vào từng ô để mở toàn bộ nội dung, bấm lại để thu gọn.
- Thêm đường kẻ dọc màu xám nhạt giữa tất cả cột ngày, số liệu, trạng thái và nhận xét để dễ dò dữ liệu.

## Kiểm tra đã thực hiện

- ESLint riêng `components/ppa-heat-rate-dashboard.tsx`: đạt.
- `npx.cmd tsc --noEmit`: đạt.
- `node --test tests/*.mjs`: đạt 30/30.
- `npm.cmd run build`: đạt.

## Còn thiếu

- Chưa kiểm tra trực quan trong trình duyệt thật ở lượt này vì phiên làm việc không được kết nối Edge/Chrome; cần kiểm tra lại sau khi triển khai hoặc chạy localhost.

---

# Bổ sung 18/09/2026 — Phân quyền tài khoản theo Cương vị (Chức vụ) PXVH1

## Bối cảnh & Yêu cầu

Người dùng cung cấp danh sách đầy đủ 124 nhân sự Phân xưởng Vận hành 1 (Nhà máy nhiệt điện Duyên Hải 1) gồm Mã NV, Họ tên, Email, Cương vị (Chức vụ), Bộ phận, Tên đăng nhập, Mật khẩu và yêu cầu:
> *"Hãy tạo phân quyền tài khoản theo danh sách này theo cương vị, còn việc cương vị nào có quyền gì thì tôi sẽ phân."*

## Đã làm

1. **Chuyển đổi mô hình phân quyền sang RBAC theo Cương vị (Position-based RBAC)**:
   - Thay vì chỉ có 3 role cố định (`admin`, `editor`, `viewer`) gắn cứng vào từng user, hệ thống đã chuẩn hóa **25 Cương vị** của phân xưởng (Quản đốc, Phó Quản đốc, Kỹ thuật viên, Trưởng ca, Lò trưởng, Máy trưởng, Trưởng kíp điện, ESP, FGD, Máy nghiền, v.v.).
   - Mỗi Cương vị có thể được cấp phát độc lập **8 quyền hạn chức năng chi tiết**:
     - `manage_users`: Quản trị tài khoản & phân quyền
     - `edit_monthly_kpi`: Nhập & tính 7 chỉ tiêu KTKT tháng (`/`)
     - `edit_daily_inputs`: Nhập & lưu số liệu sản xuất ngày (`/`)
     - `edit_ppa`: Quản lý Suất hao nhiệt PPA (`/ppa-heat-rate`)
     - `edit_pmis`: Quản lý Báo cáo PMIS / Tổn thất khói (`/pmis-report`)
     - `edit_bcsx`: Nhập 48 điểm nửa giờ & xuất file BCSX (`/bcsx-report`)
     - `sync_qlkt`: Kích hoạt tiện ích đồng bộ tự động từ QLKT
     - `sync_google_sheet`: Đẩy số liệu & đồng bộ Google Sheet
     - `view_all`: Quyền xem dữ liệu và báo cáo (mặc định tất cả các cương vị đều có).

2. **Cập nhật Cơ sở dữ liệu**:
   - Mở rộng bảng `users` (`db/schema.ts`): thêm các trường `employee_code`, `position`, `department`, `email_company`, `email_work`, `phone`, `status`.
   - Tạo bảng mới `position_permissions`: lưu trữ ma trận phân quyền cho từng Cương vị (`position`, `role`, `permissions` dạng JSON array, `description`).
   - Tạo file migration: `drizzle/0005_position_permissions.sql` và script SQL chạy trực tiếp trên Turso: `drizzle/schema-turso-update.sql`.

3. **Cập nhật Logic Xác thực & Phiên (Auth Session & Guards)**:
   - `lib/auth/session.ts`: Thêm `Permission`, `hasPermission(user, permission)`, mở rộng `SessionUser` chứa `position`, `employeeCode`, `permissions`.
   - `app/api/auth/login/route.ts`: Khi đăng nhập, tự động truy vấn quyền của Cương vị từ `position_permissions`, nhúng vào JWT cookie. Chặn đăng nhập nếu tài khoản có trạng thái `locked`.
   - `lib/auth/server.ts`: Thêm `requirePermission(permission)`, cập nhật `requireEditor()` và `requireAdmin()` tự động đối soát theo quyền hạn Cương vị.
   - `proxy.ts`: Cho phép người dùng có quyền `manage_users` truy cập khu vực Quản trị.

4. **Bộ dữ liệu chuẩn 124 Nhân sự & 25 Cương vị (`lib/auth/initial-users-data.ts`)**:
   - Chuẩn hóa toàn bộ 124 nhân sự từ danh sách của người dùng: tên đăng nhập sạch, mã NV đúng định dạng, mật khẩu được mã hóa an toàn bằng thuật toán `scrypt` (`hashPassword`).
   - Viết hàm `seedUsersAndPositions(db)` tự động khởi tạo hoặc cập nhật cấu trúc và dữ liệu.
   - Viết API `POST /api/admin/seed-users` và script CLI `scripts/seed-pxvh1-users.mjs`.

5. **Giao diện Quản trị (`components/admin-users-panel.tsx`)**:
   - **Tab 1: Phân quyền theo Cương vị (Ma trận phân quyền)**:
     - Bảng ma trận 25 Cương vị với checkbox cho từng quyền chức năng.
     - Bộ lọc nhanh theo khối vận hành (Lò, Máy, Điện, Hóa, Phụ trợ, Lãnh đạo).
     - Các nút gán mẫu quyền nhanh: "Tất cả (Admin)", "Ca (Vận hành ca)", "KT (Kỹ thuật viên)", "Xem".
     - Nút "Lưu phân quyền Cương vị" để lưu cấu hình ngay lập tức vào database.
     - Nút "⚡ Nạp/Đồng bộ 124 Nhân sự PXVH1" cho phép Admin khởi tạo dữ liệu trực tiếp bằng 1 click.
   - **Tab 2: Danh sách Nhân sự (124 tài khoản)**:
     - Tìm kiếm tức thì theo Họ tên, Mã NV, Tên đăng nhập.
     - Lọc theo Cương vị và Trạng thái (Hoạt động / Tạm khóa).
     - Đổi mật khẩu, khóa/mở khóa tài khoản, xóa tài khoản, thêm tài khoản mới.

6. **Tích hợp kiểm tra quyền ở các trang chức năng**:
   - `components/bcsx-report.tsx` & `app/api/shift-readings`, `app/api/operating-events`: Kiểm tra quyền `edit_bcsx`.
   - `components/daily-production-table.tsx`: Kiểm tra quyền `edit_daily_inputs` và `edit_monthly_kpi`.
   - `components/pmis-report.tsx`: Kiểm tra quyền `edit_pmis`.
   - `components/ppa-heat-rate-comparison.tsx` & `ppa-heat-rate-bulk-import.tsx`: Kiểm tra quyền `edit_ppa`.
   - `components/google-sheet-sync-button.tsx`: Kiểm tra quyền `sync_google_sheet`.

7. **Kiểm thử tự động**:
   - Tạo `tests/position-permissions.test.mjs`: kiểm tra tính toàn vẹn của 25 cương vị, 124 tài khoản nhân sự (không trùng username, đủ mã NV, mật khẩu hợp lệ) và kiểm thử logic hàm `hasPermission`.

# Bổ sung 19/09/2026 — Chẩn đoán đồng bộ Google Sheet

## Đã kiểm tra

- Gọi trực tiếp Google Apps Script đang cấu hình với `GET ?action=dates`: phản hồi JSON `ok: true`, đọc được trang `DH1` và xác định ngày `18/09/2026` tại hàng 51.
- Gửi POST chẩn đoán với token cố ý sai và danh sách ngày rỗng: Apps Script trả đúng lỗi `Sai token`, chứng tỏ nhánh `doPost` và kiểm tra token đang hoạt động.
- Gửi POST với token đang dùng và danh sách ngày rỗng: Apps Script trả `ok: true`, `results: []`; thao tác không ghi hoặc thay đổi dữ liệu Google Sheet.

## Kết luận và phần còn dở

- URL triển khai Apps Script, mã kết nối và hàng ngày 18/09/2026 đều hợp lệ. Lỗi người dùng gặp không xuất phát từ ba thành phần này.
- Giao diện hiện gọi Apps Script trực tiếp từ trình duyệt và giữ URL/token trong `localStorage` của từng máy. Cách này dễ phát sinh lỗi theo trình duyệt hoặc phải thiết lập lại khi đổi máy.
- Phương án đơn giản hơn cần làm tiếp: chuyển URL/token sang biến môi trường của máy chủ và để `/api/google-sheet-sync` làm trung gian. Khi đó người dùng chỉ chọn ngày, bấm nút, xem trước và xác nhận; không phải nhập URL hoặc mã kết nối trên từng máy.
- Chưa gửi dữ liệu thật của ngày 18/09/2026 trong lượt chẩn đoán này để tránh thay đổi báo cáo chính thức khi chưa xem được lỗi đầy đủ và dữ liệu xem trước.

## Cập nhật triển khai trung gian máy chủ

- `/api/google-sheet-sync` hiện hỗ trợ hai thao tác `preview` và `sync`, tự đọc ngày từ Apps Script, xác định hàng DH1 và ghi dữ liệu qua máy chủ.
- API đã yêu cầu quyền `sync_google_sheet`; URL và token không được gửi xuống giao diện hoặc ghi vào GitHub.
- Giao diện ưu tiên cấu hình máy chủ; phương án nhập URL/token trong trình duyệt chỉ còn là dự phòng khi máy chủ chưa có cấu hình.
- Cần khai báo một lần trên Vercel: `GOOGLE_SHEET_APPS_SCRIPT_URL` (URL `/exec`) và `GOOGLE_SHEET_SYNC_TOKEN` (token hiện dùng). Chưa thể xác nhận production cho đến khi hai biến này được khai báo và deploy lại.

## Hoàn tất production 19/09/2026

- Đã khai báo `GOOGLE_SHEET_APPS_SCRIPT_URL` và `GOOGLE_SHEET_SYNC_TOKEN` dưới dạng Secret cho cả Production và Preview trên Vercel; giá trị không được ghi vào GitHub.
- Kiểm tra toàn bộ mã hiện tại: `node --test tests/*.mjs` đạt 71/71; `npx tsc --noEmit` đạt; build production đạt.
- Đã triển khai production `dpl_C7GqfRzwVcDPvChMYYSTQC4ua4tg`, trạng thái READY và alias `https://ctktkt-dashboard.vercel.app`.
- Kiểm tra sau triển khai: `/ppa-heat-rate` trả HTTP 200; `/api/google-sheet-sync` khi chưa đăng nhập trả HTTP 401 đúng cơ chế bảo vệ.
- Còn một bước nghiệm thu có kiểm soát: người dùng đăng nhập, chọn ngày đã đủ dữ liệu, bấm `Đẩy Google Sheet`, kiểm tra bảng xem trước rồi mới xác nhận ghi thật.

## Chẩn đoán lần ghi thật ngày 18/09/2026

- Log production ghi nhận một yêu cầu xem trước trả HTTP 200, sau đó hai yêu cầu xác nhận ghi đều trả HTTP 400; do đó thao tác bấm nút đã đến máy chủ nhưng thất bại ở bước gọi ghi Apps Script.
- Bổ sung hiển thị lỗi trực tiếp ngay trong hộp xem trước thay vì để thông báo phía sau lớp phủ.
- Bổ sung log máy chủ đã loại bỏ token và dữ liệu chi tiết, chỉ ghi thao tác, ngày và thông báo lỗi để chẩn đoán an toàn ở lần thử tiếp theo.
- Chưa xác định nội dung lỗi Apps Script của hai lần trước vì phiên bản lúc đó chưa ghi thông báo lỗi vào runtime log.

---
