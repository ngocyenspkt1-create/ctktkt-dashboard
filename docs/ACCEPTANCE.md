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
