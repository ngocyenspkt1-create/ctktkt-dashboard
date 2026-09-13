# Kế hoạch đạt chỉ tiêu năm

Bản bổ sung ngày 13/09/2026. Đây là phép thử phương án tại chỗ, không ghi dữ liệu thực tế, không tự tổng hợp lịch sử và không lưu khi tải lại. Không thay đổi bảng dữ liệu hoặc migration đã triển khai.

## Sử dụng

1. Chọn chỉ tiêu, năm và tháng đã chốt. Nhập mục tiêu cả năm, lượng sử dụng và mẫu số lũy kế từ tháng 1 tới hết tháng chốt.
2. Nhập sản lượng dự kiến cho từng tháng còn lại; 0 là không có sản lượng, ô trống là chưa đủ dữ liệu.
3. Đọc lượng phân bổ theo tỷ trọng sản lượng. Để trống lượng sử dụng dự kiến để dùng phân bổ; nhập một số, kể cả 0, để thử điều chỉnh.
4. Xem tổng lượng dự kiến, dư địa còn lại, chỉ tiêu năm và kết luận theo phương án. Thay đổi tháng chốt hoặc chỉ tiêu sẽ xóa số liệu mô phỏng để tránh dùng nhầm đơn vị/kỳ.

Nút “Thử ví dụ tháng 8” nạp dữ liệu giả HCl: dùng 52000 kg, điện xuất tuyến 4 tỷ kWh đến hết tháng 8; tháng 9–12 mỗi tháng 500 triệu kWh, mục tiêu 0,012 g/kWh. Hạn mức năm 72000 kg, còn 20000 kg, phân bổ mỗi tháng 5000 kg. Luôn gắn nhãn ví dụ, không ghi vào số liệu thực.

## Cơ sở tính

Vật tư: hạn mức kg = mục tiêu g/đơn vị sản lượng × sản lượng năm / 1000. Bi nghiền dùng tấn than, hóa chất/mỡ dùng điện xuất tuyến kWh. Điện tự dùng: hạn mức kWh = mục tiêu % × điện đầu cực năm / 100. Lượng điện tự dùng lũy kế theo cơ sở đang dùng của ứng dụng là đầu cực trừ xuất tuyến, không phải chỉ số công tơ tích lũy cuối kỳ.

Hạn mức còn lại = hạn mức năm − đã sử dụng. Phân bổ tháng = hạn mức còn lại × tỷ trọng sản lượng tháng trong các tháng còn lại; làm tròn xuống đến 0,001 kg/kWh để không phân bổ quá tổng. Điện tự dùng phân bổ không vượt điện đầu cực cùng tháng. Chỉ tiêu dự báo = tổng sử dụng lũy kế và dự kiến / tổng mẫu số năm, nhân 1000 hoặc 100; không trung bình các suất hao tháng.

Ngân sách âm: không có phương án sử dụng không âm nào giúp đạt với dự báo sản lượng hiện tại. Không gán lượng âm. Không có sản lượng còn lại: phân bổ bằng 0, vẫn cho nhập nhu cầu khi dừng máy; kiểm tra điện tự dùng không vượt điện đầu cực trong mô hình hiện hành. Chốt tháng 12: chỉ đánh giá cả năm.

## Giới hạn và kiểm tra

Mục tiêu là giả định không đổi cả năm, chưa có phê duyệt hiệu lực. Bảo lưu cảnh báo NH3 đầu cực/xuất tuyến, nồng độ NaOH/HCl và PAC lỏng. Phân bổ là hạn mức toán học, không phải mức tối thiểu an toàn hoặc phương án vận hành được phê duyệt. Sản lượng dự kiến không phải sản lượng bảo đảm. Dữ liệu kế hoạch nằm trong bộ nhớ trang, không thay đổi yêu cầu lưu trữ hay quyền truy cập nội bộ.

8 nhóm kiểm tra tự động mới: ví dụ tháng 8, phân bổ không đều, chỉnh riêng/giá trị 0, vượt cả hạn mức năm, không còn sản lượng/chốt tháng 12, quy đổi điện và bi, đầu vào không hợp lệ, làm tròn và giới hạn vật lý điện. Chạy cùng 5 nhóm kiểm tra hiện có: 13 nhóm đạt. Không thực hiện kiểm tra tương tác trình duyệt cho lần bổ sung này.
