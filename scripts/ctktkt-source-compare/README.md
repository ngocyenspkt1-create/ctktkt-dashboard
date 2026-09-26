# Đối chiếu file xuất Chỉ tiêu KTKT với file gốc

Dùng mỗi khi sửa code xuất file hoặc cuối tháng, để bảo đảm file xuất từ web khớp file gốc
`CHỈ TIÊU KINH TẾ KỸ THUẬT dd.mm.yyyy.xls`.

## Chuẩn bị (Windows có Excel)

File xuất từ web không lưu sẵn kết quả công thức, nên phải cho Excel tính lại cả hai file và lưu `.xlsx`:

```powershell
powershell -ExecutionPolicy Bypass -File recalc.ps1 "C:\...\CHỈ TIÊU ... 25.09.2026.xls" goc.xlsx
powershell -ExecutionPolicy Bypass -File recalc.ps1 "C:\...\CHI_TIEU_KTKT_2026-09.xlsx" web.xlsx
```

Cần Python có `openpyxl` (ví dụ Python của MarkItDown).

## Chạy

```powershell
python formula_compare.py goc.xlsx web.xlsx      # công thức khác nhau → formula_diff.json
python value_compare.py goc.xlsx web.xlsx cmp.json
python classify.py cmp.json                       # phân loại lệch giá trị
```

## Đọc kết quả

`formula_compare.py` chỉ nên còn các ô file gốc sai, web cố ý giữ đúng (xác nhận 26/09/2026):

- Tham chiếu sheet cũ trong gốc: W30–W34, AG30–AG34, M38, Y41–Y46, AI41–AI46, Y58, AI58 (gốc trỏ `'04'!`, `'06'!`… thay vì ngày trước/ngày sau).
- AK32: gốc `AL11-AK11` (trùng AL32), web `AK11-AI11` (khoảng 14h–22h).
- W59/W60, Y59/Y60, AG59: gốc chia nhầm hàng 38–40, ra #DIV/0!/#VALUE!.
- P169–R173: link ngoài `[2]16` của gốc.
- W86: gốc gõ số, web `=W89` ngày trước (cùng giá trị).

Nhóm lệch giá trị được phép: nhãn/số thứ tự, cột J lũy kế (gốc cộng dồn nhiều năm, có #REF!),
phần nháp của người lập (khối AM–AW, hàng 97–152…), giờ vận hành (web lấy QLKT từ 01/01/2026).
Mọi lệch khác là số liệu nhập trên web khác gốc hoặc lỗi cần sửa.
