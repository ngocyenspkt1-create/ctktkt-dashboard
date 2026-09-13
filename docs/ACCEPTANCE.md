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
- Chưa triển khai suất hao nhiệt PPA, hệ số khả dụng/đáp ứng từ sổ thứ hai.
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
