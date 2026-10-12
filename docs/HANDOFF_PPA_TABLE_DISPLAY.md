# PPA: bảng chi tiết theo ngày — 2026-10-12

- Repo `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`, main; baseline `8ad3bae`. Kiểm tra git status/log trước khi sửa; giữ tệp ngoài phạm vi.
- Phạm vi: bảng chi tiết ngày trong `components/ppa-heat-rate-dashboard.tsx`. Không đổi công thức, format số, dữ liệu, API hoặc tiện ích.
- Nguyên nhân chồng số: table-fixed + 17 cột số chỉ 3.94% chiều rộng, không có min-width. Đã đổi min-width 2600px, cột ngày 136px, 17 cột số/trạng thái 112px mỗi cột, hai cột nhận xét 280px. Table w-full mở rộng tiếp nếu viewport lớn.
- Khung cuộn giữ module-table-scroll (sticky header, max-height theo CSS dùng chung), thêm min-w-0/max-w-full và cuộn ngang. Nhãn Cuộn ngang để xem đầy đủ các cột; region có tabindex và aria-label.
- Chữ bảng text-sm (14px mặc định), badge/nhận xét phụ 13px, padding ô 8px, số tabular-nums và nowrap cho cột 1–18. Nhận xét vẫn mở/đóng, cho phép wrap nội dung. Chỉ sửa style tại bảng và helper nhận xét dùng riêng trong bảng; không sửa CSS dùng chung.
- Kiểm thử liên quan: 21/21 PPA/notes/persistence đạt. Trước push chạy next build theo vercel.json và storage:check, xác minh SHA/deployment. Storage 12/10: 13.73MiB, 126815 dòng; provider usage/định mức chưa có kết nối dashboard để xác minh.
- Người dùng Ctrl+F5 trang Suất hao nhiệt PPA → So sánh trực quan → bảng ngày, cuộn ngang trên máy có viewport hẹp. Chưa kiểm chứng authenticated UI từng máy; redirect login không phải bằng chứng giao diện.
