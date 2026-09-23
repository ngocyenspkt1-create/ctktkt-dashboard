# Bàn giao trạng thái hiện tại dự án CTKTKT

## Cập nhật 23/09/2026 — làm rõ lỗi PPA “đủ 4 điểm đo nhưng chưa tính được”

- Ảnh production ngày 22/09/2026 cho thấy tiện ích đã nhận đủ tên 4 công tơ và 48 chu kỳ, nhưng phép tính PPA bị loại; nguyên nhân kỹ thuật có thể là tổng sản lượng điểm bán S1 hoặc S2 bằng 0. Giao diện cũ nuốt lỗi này rồi hiển thị chung “Chưa có dữ liệu PPA”.
- Màn hình mới giữ trạng thái 4/4 điểm đo nhưng báo chính xác tổ máy có tổng điểm bán bằng 0 hoặc dữ liệu chu kỳ không hợp lệ. Phần thực tế đồng thời liệt kê các mã Chỉ tiêu KTKT còn thiếu trong `C, I, AE, AF, AJ`.
- Bổ sung kiểm thử trường hợp tổng điểm bán S2 bằng 0. Kiểm tra đạt: 173/173 test, TypeScript, ESLint phạm vi sửa, build production và `git diff --check`.
- Ảnh người dùng đang dùng bản production cũ (`Đồng bộ PPA từ QLKT` và thông báo “Hãy kiểm tra kết quả trước khi lưu”); thay đổi mới hiện chỉ ở working tree, chưa commit/push/deploy.
- `npm.cmd run storage:check` bị chặn vì giá trị `TURSO_DATABASE_URL` trong `.env.local` không có định dạng URL hợp lệ; token đã có nhưng chưa thể kết nối để xác minh dung lượng Turso/Vercel.

## Cập nhật 23/09/2026 — NH3 DCS D−D-1, lưu đúng ô và liên kết một nguồn

- NH3 DCS ngày D chỉ nhập công tơ 24h tại `N81/N82`; công tơ đầu ngày `M81/M82` là chỉ đọc và tự lấy từ `N81/N82` ngày D-1. Lượng dùng S1/S2 được tính bằng công tơ 24h ngày D trừ công tơ 24h ngày D-1 và tự liên kết sang `BQ/BR`.
- Nguồn liên kết chung từ Chỉ tiêu KTKT sang Dữ liệu các tháng/PMIS gồm `B, C, H, I, X, AE, AF, AJ, AT, BN, BQ, BR, CJ, CN`. API không cho lưu lần hai các mã này; BCSX chỉ lưu riêng dữ liệu không trùng nguồn.
- Lưu tay đã được thu hẹp theo thay đổi thực tế: Chỉ tiêu KTKT chỉ gửi các ô bẩn; bảng BCSX chỉ gửi các điểm đo vừa gõ/dán; báo cáo Nước gửi `changedFields` và API giữ nguyên mọi trường không sửa. Các luồng nhập file, đồng bộ nhiều mã và thay danh sách sự kiện vẫn là thao tác hàng loạt có chủ đích.
- Kiểm tra đạt: 172/172 test, `npx.cmd tsc --noEmit`, build production và `git diff --check`. ESLint riêng `components/pmis-report.tsx` không còn lỗi; lint phạm vi rộng vẫn còn lỗi/cảnh báo hiện hữu ở các màn hình cũ nên chưa thể ghi nhận lint toàn dự án đạt.
- `npm.cmd run storage:check` hiện bị chặn vì `TURSO_DATABASE_URL` trong `.env.local` không có định dạng URL hợp lệ; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng Turso/Vercel. Chưa nghiệm thu thao tác bằng trình duyệt với tài khoản thật trong lượt local này.

## Cập nhật 23/09/2026 — bảo toàn dữ liệu khi đồng bộ và thống nhất nguồn PPA thực tế

- Trang Chỉ tiêu KTKT chỉ gửi các ô người dùng vừa sửa thay vì gửi lại toàn bộ ô được phân quyền; đọc lại CSDL sau khi lưu vẫn được giữ. Đồng bộ PMIS/02-PĐ không còn xóa trạng thái các ô nhập tay khác, và khóa đổi ngày trong lúc đang lưu/nhập lịch sử/đồng bộ để tránh lẫn dữ liệu giữa hai ngày.
- Hai luồng nhập lệnh vận hành BCSX chỉ thay thế sự kiện của tổ máy khi file hoặc tiện ích thực sự trả về sự kiện cho tổ đó. Nếu S1 hoặc S2 không có sự kiện đầu vào, dữ liệu đã lưu của tổ tương ứng được giữ nguyên thay vì bị xóa.
- Trang PPA lấy các trường sản lượng, than và nhiệt trị dùng tính suất hao nhiệt thực tế từ Chỉ tiêu KTKT; chỉ giữ các trường QLKT không trùng nguồn. Yêu cầu tải tháng cũ bị hủy khi người dùng chuyển tháng để phản hồi đến muộn không ghi đè màn hình hiện tại.
- Nhãn nút PPA đổi thành `Lấy công tơ PPA từ QLKT` để phân biệt rõ: QLKT chỉ cấp bốn công tơ PPA, còn suất hao nhiệt thực tế liên kết từ Chỉ tiêu KTKT.
- Kiểm tra đạt: 169/169 test, `npx.cmd tsc --noEmit`, ESLint phạm vi sửa không có lỗi, `git diff --check` và build production. `npm.cmd run lint` toàn dự án vẫn không đạt do 14 lỗi/22 cảnh báo tồn tại ở các file ngoài phạm vi; các file sửa trong lượt này không phát sinh lỗi lint mới.
- `npm.cmd run storage:check` bị chặn chính xác vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng Turso hoặc Vercel.

## Cập nhật 23/09/2026 — sửa đẩy Google Sheet khi một tổ có sản lượng bằng 0

- Nguyên nhân lỗi “Thiếu dữ liệu Đầu cực S1”: giao diện đã lấy sản lượng liên kết từ Chỉ tiêu KTKT, nhưng API Google Sheet vẫn chỉ đọc trường cũ trong `daily_inputs` nên không thấy mã `B`.
- API Google Sheet nay ghép cùng nguồn CTKTKT như Dữ liệu các tháng; giá trị `0` của tổ dừng là dữ liệu hợp lệ và vẫn cho phép đẩy ngày lên Google Sheet.
- Kiểm tra đạt: 163/163 test, TypeScript, ESLint phạm vi sửa và build production.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng.

## Cập nhật 23/09/2026 — sửa suất hao nhiệt tinh toàn nhà máy khi một tổ dừng

- Nguyên nhân ô toàn nhà máy trống: công thức cũ yêu cầu cả S1 và S2 đều có suất hao nhiệt; khi một tổ có điện giao bằng 0, suất hao nhiệt tổ đó không xác định và làm kết quả toàn nhà máy thành trống.
- Công thức mới tính trực tiếp từ tổng than quy ẩm, nhiệt trị chung và tổng điện giao toàn nhà máy; nếu một tổ dừng nhưng tổ còn lại có đủ dữ liệu thì kết quả toàn nhà máy vẫn hiển thị.
- Kiểm tra đạt: 162/162 test, TypeScript, ESLint phạm vi sửa và build production.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng.

## Cập nhật 23/09/2026 — liên kết độ ẩm trung bình ngày từ Chỉ tiêu KTKT

- Cột `CJ` — Độ ẩm TB ngày tại Dữ liệu các tháng tự lấy từ Chỉ tiêu KTKT, không nhập lặp.
- Công thức web khớp ô Excel `AJ86`: tổng `than chưa quy ẩm × Wtp` của 6 ca S1/S2 chia tổng than chưa quy ẩm trong ngày.
- Kiểm tra đạt: 161/161 test, TypeScript, ESLint phạm vi sửa và build production.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng.

## Cập nhật 23/09/2026 — bổ sung công tơ NH3 DCS và liên kết Dữ liệu các tháng

- Bổ sung bảng nhập công tơ NH3 DCS S1/S2 theo đúng vùng `M81:N82` của file Excel gốc; lượng dùng bằng công tơ 24h trừ công tơ 00h.
- Chỉ Lò trưởng và Trưởng kíp điện được nhập nhóm `nh3_dcs`; nhóm mức bồn NH3 hiện hữu giữ nguyên quyền riêng.
- Sản lượng đầu cực/MBA lấy từ PMIS `J157:K158`; tự tính kg và suất tiêu hao g/kWh.
- Lượng NH3 DCS S1/S2 tự liên kết sang mã `BQ`/`BR` tại Dữ liệu các tháng.
- Kiểm tra đạt: 160/160 test, `npx.cmd tsc --noEmit`, ESLint không có lỗi và `npm.cmd run build` thành công.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng.

## Cập nhật 23/09/2026 — sửa đơn vị dầu FO S2 khi liên kết Dữ liệu các tháng

- Công tơ dầu S1 (`W:AB`, hàng 13–14) có đơn vị tấn; công tơ dầu S2 (`AG:AL`, hàng 13–14) có đơn vị kg. Trước đây web cộng trực tiếp kết quả S1 và S2 nên phần S2 bị phóng đại 1.000 lần trong cột `Dầu FO tiêu thụ`.
- `calculateOilDifferences` nay luôn trả về tấn: giữ nguyên S1 và chia kết quả S2 cho 1.000. Công thức vật lý vẫn là `ΔF1 − ΔF2`, không lấy trị tuyệt đối và không tự đảo dấu.
- Với dữ liệu 01–19/09/2026 đã nhập, giá trị sau sửa còn khoảng `-1,835` đến `-5,063 t/ngày` thay vì hàng trăm tấn âm. Dấu âm còn lại phản ánh `ΔF2 > ΔF1`, cần kiểm tra sai lệch/đảo kênh công tơ cấp lò và dầu về bồn; hệ thống không che giấu bằng cách ép về 0.
- Kiểm tra đạt 153/153 test, TypeScript, ESLint phạm vi sửa và build production; bộ nhập lịch sử vẫn đối chiếu đúng kết quả Excel S2 sau khi quy đổi kg sang tấn.

## Cập nhật 23/09/2026 — không còn phụ thuộc Reload để sửa payload PMIS cũ

- Reload Chrome/Edge chỉ nạp lại mã trong đúng thư mục tiện ích đang cài, không tự tải bản mới từ website. Nếu tiện ích đang trỏ tới thư mục giải nén cũ, bấm Reload vẫn giữ nguyên mã cũ.
- Web nay tự lọc lần cuối trước khi hiển thị và lưu: chỉ chấp nhận `J157/K157/J158/K158` cùng `C181:T181`; các mã Dữ liệu các tháng như `B/C/H/I` từ tiện ích cũ bị loại bỏ hoàn toàn.
- Trang Chỉ tiêu KTKT không còn chặn nút đồng bộ chỉ vì tiện ích thấp hơn `0.4.30`. Tiện ích `0.4.29` vẫn dùng được an toàn cho riêng luồng `Đồng bộ PMIS & 02-PĐ`; các trang khác vẫn giữ kiểm tra phiên bản theo yêu cầu riêng.
- Kiểm tra đạt 153/153 test, TypeScript, ESLint phạm vi sửa và build production; kiểm thử hồi quy mô phỏng trực tiếp payload của tiện ích cũ có `B/C/H/I`.

## Cập nhật 23/09/2026 — sửa lỗi đồng bộ PMIS báo ô B không được phép nhập

- Nguyên nhân: tiện ích QLKT trộn các mã dùng cho bảng Dữ liệu các tháng (`B/C/H/I/...`) từ màn hình Sản lượng vào payload lưu ô Excel của Báo cáo Chỉ tiêu KTKT, nên API chặn đúng tại mã `B`.
- Luồng `Đồng bộ PMIS & 02-PĐ` nay chỉ nhận bốn ô sản lượng `J157/K157/J158/K158` từ màn hình Sản lượng; các ô báo cáo 02-PĐ tiếp tục lấy từ hàng Duyên Hải 1 như trước.
- Nâng tiện ích lên `0.4.30` để web nhận diện và yêu cầu Reload bản đã sửa; hai cây nguồn và bản phát hành được giữ đồng nhất.
- Kiểm tra đạt 151/151 test, TypeScript, ESLint phạm vi sửa và build production. ZIP phát hành chứa đúng manifest `0.4.30` và bộ lọc bốn ô sản lượng; SHA-256 `1A784D61A9552EB55486686935FFE50B57C174C57403913799F1E3796A339CAA`.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng.

## Cập nhật 22/09/2026 — tách sản lượng PMIS và sản lượng tính theo công tơ

- Cụm 1 hiển thị song song cột **PMIS/QLKT** và **Công tơ/Excel** cho bốn chỉ tiêu điện: đầu cực, phát lưới, điện tự dùng và tỷ lệ tự dùng của S1, S2, toàn nhà máy.
- PMIS tại `J157/K157/J158/K158` tiếp tục là nguồn chính cho KPI trên web, Báo cáo gửi mail, BCSX và các suất hao. Sản lượng tính theo chênh công tơ chỉ dùng để đối chiếu và theo dõi công thức trong file Excel.
- Nhập file lịch sử theo ngày đối chiếu các ô công thức Excel `E20:H27`, `AU86:AV88` bằng đúng sản lượng chênh công tơ như mẫu gốc, không còn báo sai giả do so với PMIS. Các sai lệch công thức khác vẫn bị chặn như trước.
- File Excel xuất tháng vẫn giữ nguyên công thức công tơ, đồng thời ghi riêng sản lượng PMIS; cấu trúc, công thức, merge, style và thiết lập in không thay đổi.
- Kiểm tra đạt 149/149 test, TypeScript, ESLint phạm vi sửa và build production; test riêng xác nhận mail luôn lấy PMIS khi PMIS khác công tơ và nhập lịch sử dùng công tơ để kiểm tra công thức. Thay đổi này chỉ ở web, không sửa tiện ích QLKT `0.4.29`.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng.

## Cập nhật 22/09/2026 — sửa nhập lệnh điều độ ngày 21/09 cho S1

- Nguyên nhân S1 không xuất hiện: bộ nhập trước đây chỉ nhận dòng có Nội dung lệnh `Thay đổi công suất`, nên dòng S1 `Ngừng tổ máy` đã hoàn thành bị bỏ qua. Hai dòng S1 thay đổi công suất 330,7 MW và 225,7 MW vẫn được bỏ đúng vì chưa hoàn thành/đã dừng.
- Bộ nhập hiện phân loại theo **Nội dung lệnh**, không suy loại sự kiện từ Lý do lệnh hoặc ghi chú: thay đổi công suất = loại 1; đốt lò/khởi động/hòa lưới/ngừng tổ máy = loại 2; tách sửa chữa/đưa dự phòng sau sửa chữa = loại 3; bất thường/quá tải/điện áp/nhiệt độ = loại 4; ngừng sự cố/bảo vệ tác động = loại 5.
- Nếu có lệnh `Ngừng tổ máy` đưa công suất về 0 MW, sự kiện được ghi loại 2 và suy công suất đầu là tải tối thiểu 435,7 MW. Nếu chỉ có lệnh thay đổi công suất giảm dưới tải tối thiểu rồi tăng lại, không có lệnh ngừng về 0 MW, các dòng đó vẫn là loại 1.
- Ngoại lệ trip: nếu công suất trước sự kiện từ 435,7 MW trở lên, công suất hoàn thành bằng 0 MW và thời gian từ bắt đầu đến hoàn thành **nhỏ hơn 3 phút**, hệ thống tự chuyển thành loại 5 `Ngừng sự cố tổ máy do bảo vệ tác động`. Thời gian đúng 3 phút trở lên không thỏa điều kiện trip tự động và vẫn giữ loại theo Nội dung lệnh.
- Lệnh khởi động hoặc hòa lưới thuộc loại 2. Lệnh tách sửa chữa theo kế hoạch hoặc đưa tổ máy vào dự phòng thuộc loại 3.
- Đối chiếu file thật `DanhSachLenhKetThuc-20260922_203848685.xlsx` cho ngày 21/09/2026: nhận 3 dòng hoàn thành, bỏ 2 dòng chưa hoàn thành; S1 có 1 sự kiện loại 2 lúc 07:55–09:56; S2 có 2 sự kiện loại 1 lúc 14:32–15:03 và 15:04–15:28. Kiểm tra đạt: 146/146 test, TypeScript, ESLint phạm vi sửa và build production.
- `npm.cmd run storage:check` chưa truy cập được Turso vì môi trường local thiếu `TURSO_DATABASE_URL`; chưa có số liệu xác thực để kết luận tỷ lệ sử dụng hoặc phát cảnh báo ngưỡng.

## Cập nhật 22/09/2026 — tách tồn kho BCSX 24h và liên kết một nguồn dữ liệu

- Mục 2 BCSX chỉ cho nhập tay **Than tồn kho 24h**, lưu bằng mã riêng `BCSX_COAL_STOCK_24H` và dùng chung khi xuất S1, S2, A0. Mã này không đọc hoặc ghi đè `AR` của QLKT.
- Ba giá trị còn lại của Mục 2 BCSX (đầu cực, thương phẩm, than tiêu thụ) là dữ liệu chỉ đọc, tự lấy từ Báo cáo chỉ tiêu KTKT.
- Trên Dữ liệu các tháng, `AR` đổi nhãn thành **Than tồn kho 06h00**. Các trường `B/C/H/I/X/AE/AF/AJ/AT` tự liên kết từ Báo cáo chỉ tiêu KTKT; không còn xuất hiện trong gói đồng bộ QLKT của trang này.
- Tiện ích QLKT `0.4.29` cho Dữ liệu các tháng chỉ trả `F/L/AR/CC/CD/CS/CT/CU/CV`, giảm nguồn đọc hằng ngày từ ba màn hình xuống hai màn hình Nhiên liệu và Vận hành.

## Cập nhật 22/09/2026 — nhập lệnh điều độ trực tiếp cho Mục 3 BCSX

- Mục 3 không còn nút đồng bộ sự kiện từ QLKT. Người dùng chọn một file DanhSachLenhKetThuc*.xlsx ngay trong Mục 3.
- Máy chủ chỉ nhận lệnh thay đổi công suất đã hoàn thành của Duyên Hải 1, tự phân S1/S2, bỏ giây, nối công suất hoàn thành trước–sau theo từng tổ máy và lưu thay toàn bộ nhật ký ngày trong một giao dịch.
- Cùng thao tác đó tự tải file DH1_Thoi_gian_VH_DD.MM.YYYY.xlsx, sheet DH1 TGVH, đủ 5 cột BĐ, KT, Mã SK, Sự kiện, TM để nhập lên QLKT.
- File nguồn mẫu không đọc được bằng MarkItDown do stylesheet XML không hợp lệ; ExcelJS đọc được và được dùng làm bộ phân tích cấu trúc chính.
- Đối chiếu file thật ngày 19/09/2026: 24/24 lệnh được nhận, S1 12 dòng, S2 12 dòng, đúng thời gian và thứ tự đến giây. Sáu khác biệt mô tả so với file mẫu đều do mẫu dùng câu sai kỹ thuật “Giảm tải S2 ... lên ...”; file mới dùng “về”.
- Kiểm tra đạt: 138/138 test, TypeScript, ESLint phạm vi sửa và build production. File QA: .analysis/bcsx-operation-import/DH1_Thoi_gian_VH_generated.xlsx.
- npm.cmd run storage:check chưa truy cập được Turso vì môi trường local thiếu TURSO_DATABASE_URL; chưa có số liệu để kết luận mức sử dụng. Vercel/Turso dashboard chưa được kiểm tra trong lượt local này.
- Đã commit, push lên github/main và triển khai Vercel production ngày 22/09/2026. Bước nghiệm thu nghiệp vụ tiếp theo: đăng nhập bằng tài khoản có quyền sửa BCSX, chọn ngày 19/09/2026, nhập file thật, xác nhận Mục 3 S1/S2 và thử upload file vừa tải lên QLKT.

## Cập nhật 22/09/2026 — QLKT bắt buộc, sửa đồng bộ PMIS và sự kiện đốt dầu

- Cụm 1 chỉ dùng sản lượng QLKT tại `J157/K157/J158/K158`; thiếu ô nào thì để trống, không quay về chênh công tơ.
- Sửa hợp đồng đồng bộ PMIS từ tiện ích: chuẩn hóa `fieldCode` thành `cell`, chặn lưu khi thiếu một trong bốn ô sản lượng và nâng tiện ích lên `0.4.28`.
- Sự kiện đốt dầu lưu rõ tổ máy, giờ bắt đầu, giờ hòa lưới, giờ/tải tối thiểu; tính riêng dầu từ bắt đầu đến hòa lưới và từ hòa lưới đến tải tối thiểu theo công tơ cấp trừ công tơ hồi.
- File Excel xuất ghi lại ba mốc, lượng dầu từng giai đoạn và tổng dầu sự kiện.

## Cập nhật 20/09/2026 — Chuẩn hóa nhãn ca 08h/16h/24h

### Đã làm

- Sửa đồng nhất trên `/ctktkt-report`: 08h thuộc Ca 1, 16h thuộc Ca 2, 24h thuộc Ca 3 cho cả S1 và S2.
- Sửa nhãn bảng than trộn và metadata các ô hiệu chỉnh cân than/than trộn theo cùng thứ tự Ca 1 → Ca 2 → Ca 3.
- Thêm kiểm thử hồi quy cho thứ tự ca. Không đổi mapping ô, giá trị lưu hoặc công thức Excel.

### Kiểm tra và bước tiếp theo

- 99/99 test đạt khi chạy tuần tự với giới hạn bộ nhớ 1 GB; TypeScript và build production đạt.
- ESLint phạm vi sửa không có lỗi; `ctktkt-report.tsx` còn 13 cảnh báo unused tồn tại từ trước.
- Sau deploy: nhấn `Ctrl+F5`, mở Chỉ tiêu KTKT và đối chiếu tiêu đề `08h (Ca 1)`, `16h (Ca 2)`, `24h (Ca 3)` tại S1, S2 và bảng than trộn.

**Ngày rà soát:** 18/09/2026  
**Phạm vi:** Đọc trạng thái Git, mã nguồn, tài liệu nghiệm thu và chạy lại các kiểm tra kỹ thuật. Không sửa chức năng, không thay đổi cơ sở dữ liệu, không commit/push.

## 1. Vị trí và trạng thái Git

- Thư mục ứng dụng: `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`
- Nhánh: `main`
- Commit hiện tại: `aea05b1`
- Nội dung commit: `fix(auth): make initial-users-data self-contained for Vercel TypeScript build`
- Remote bàn giao đúng: `github=https://github.com/ngocyenspkt1-create/ctktkt-dashboard.git`
- Đã `fetch github` và xác nhận `HEAD == github/main` tại commit trên.
- Đã deploy thành công lên Vercel production; tiện ích hiện tại là v0.4.23.

> Lưu ý: Sau khi tạo file này, `docs/HANDOFF_CURRENT.md` là file mới chưa commit.

## 2. Kiến trúc hiện tại

- Giao diện: React 19 + Next.js 16/Vinext + TypeScript + Tailwind CSS.
- API: route handlers trong `app/api`.
- Cơ sở dữ liệu: Turso/libSQL qua `@libsql/client/http`; mã SQL vẫn theo SQLite.
- Triển khai mục tiêu: Vercel.
- Xác thực: cookie JWT, bí mật lấy từ biến môi trường `AUTH_SECRET`.
- Các biến môi trường chính: `AUTH_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Tiện ích trình duyệt QLKT: Manifest V3, phiên bản `0.4.23`.

## 3. Chức năng đã có trong mã nguồn

### 3.1. Chỉ tiêu KTKT và dữ liệu sản xuất

- Nhập trực tiếp số liệu tháng cho 7 chỉ tiêu KTKT.
- Máy chủ tính kết quả, so sánh định mức và lưu lịch sử.
- Bảng dữ liệu sản xuất theo ngày, ghi chú và cảnh báo CE/CF.
- Kế hoạch năm và phân bổ phần còn lại theo sản lượng dự kiến.

### 3.2. Suất hao nhiệt PPA

- Trang `/ppa-heat-rate`.
- Đồng bộ 4 công tơ và 48 chu kỳ nửa giờ từ QLKT.
- Có phương án dự phòng: tải hoặc dán CSV.
- Tính PPA cho S1, S2 và toàn nhà máy; so sánh với suất hao nhiệt thực tế.
- Nhập, sửa và lưu nhận xét riêng cho S1/S2.
- Biểu đồ, bảng lịch sử và xuất workbook Excel.
- Chuẩn bị dữ liệu đồng bộ Google Sheet.

### 3.3. Báo cáo PMIS

- Trang `/pmis-report`.
- Theo dõi 5 chỉ tiêu cho hai tổ máy S1/S2.
- Đồng bộ QLKT một ngày hoặc theo khoảng tối đa 62 ngày/lần.
- Bảng dữ liệu theo ngày và hai biểu đồ S1/S2 đặt cạnh nhau.
- Mỗi chỉ tiêu dùng miền trục Y riêng; PG dùng miền 400–625 MW.

### 3.4. Nhập liệu và xuất BCSX

- Trang `/bcsx-report`.
- Nhập 48 điểm nửa giờ, hiển thị 3 ca song song.
- Điều hướng bằng Enter/mũi tên và dán nhanh dữ liệu từ Excel.
- Nạp số tổng ngày từ bảng `daily_inputs`; có thể sửa và lưu lại.
- Đồng bộ nhật ký sự kiện vận hành từ QLKT hoặc nhập tay bổ sung.
- Xuất file mẫu `BCSX_NMD_A0`, `BCSX_NMD_S1`, `BCSX_NMD_S2`.
- A0 được tính từ S1+S2 theo logic hiện có; than tồn kho dùng một giá trị chung, không cộng đôi.

### 3.5. Tài khoản và phân quyền

- Trang `/admin/users`.
- Có 25 Cương vị và 10 quyền trong danh mục (9 quyền chức năng cùng quyền xem `view_all`).
- Ma trận phân quyền theo Cương vị; có tìm kiếm/lọc người dùng.
- Thêm, sửa, khóa/mở khóa, đổi mật khẩu và xóa tài khoản.
- Mã nguồn hiện chứa bộ dữ liệu khởi tạo 163 tài khoản.

### 3.6. Tiện ích QLKT v0.4.23

- Kết nối dashboard Vercel/localhost với QLKT.
- Đọc công tơ PPA, số liệu sản xuất, cân bằng nhiệt và nhật ký sự kiện.
- Hai bản nguồn phải luôn đồng nhất:
  - `browser-extension/qlkt-sync`
  - `public/qlkt-sync-extension`
- File phát hành: `public/qlkt-sync-extension.zip`.

## 4. Kết quả kiểm tra ngày 18/09/2026

### Đạt

- `node --test tests/*.mjs`: **44/44 test đạt**.
- `npx.cmd tsc --noEmit`: **đạt 100% (0 lỗi)**; `initial-users-data.ts` đã tự chứa các kiểu dữ liệu và hàm băm, không phụ thuộc đuôi file.
- `npm.cmd run build`: **đạt**; build tạo đủ các trang và API hiện có.
- `git diff --check`: **đạt**.
- Đã fetch GitHub và xác nhận commit cục bộ trùng `github/main`.
- Vercel deployment: **đạt**; cần kiểm tra lại `manifest.json` trên live site sau khi phát hành v0.4.23.

### Chưa đạt

- `npm.cmd run lint`: **không đạt — 10 lỗi, 7 cảnh báo**.
  - Lỗi tập trung tại `admin-users-panel.tsx`, `daily-production-table.tsx`, `pmis-report.tsx`, `ppa-heat-rate-comparison.tsx`.
  - Chủ yếu là `react-hooks/set-state-in-effect` và truy cập `ref.current` trong lúc render.

## 5. Rủi ro cần xử lý trước khi dùng thật

### P0 — Mật khẩu và dữ liệu nhân sự

- `lib/auth/initial-users-data.ts` đang chứa mật khẩu khởi tạo dạng rõ trong mã nguồn.
- Có 163 tài khoản; 162 tài khoản dùng chung một mật khẩu mặc định.
- Dù mật khẩu được băm bằng `scrypt` khi ghi vào cơ sở dữ liệu, việc để mật khẩu rõ trong Git là không phù hợp để vận hành thật.
- Không ghi lại giá trị mật khẩu trong tài liệu hoặc trao đổi tiếp theo.

**Việc cần làm:**

1. Loại toàn bộ mật khẩu rõ khỏi repository.
2. Sinh mật khẩu tạm riêng/ngẫu nhiên hoặc luồng đặt mật khẩu ban đầu.
3. Buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
4. Đổi ngay mọi mật khẩu đã từng đưa vào repository nếu dữ liệu đã được nạp lên hệ thống thật.
5. Rà soát việc lưu họ tên, email, số điện thoại và mã nhân viên theo yêu cầu bảo vệ dữ liệu nội bộ.

### P0 — Phân quyền API chưa đúng mức chi tiết

- `lib/auth/server.ts::requireEditor()` chấp nhận người dùng có bất kỳ quyền chỉnh sửa nào.
- Các API `daily-inputs`, `measurements`, `ppa-heat-rate` và `ppa-heat-rate/notes` đang dùng guard chung này.
- Vì vậy người chỉ có một quyền, ví dụ `edit_bcsx`, vẫn có thể gọi trực tiếp API sửa PPA hoặc dữ liệu tháng dù giao diện đã ẩn/khóa nút.
- Quyền `sync_qlkt` chưa được kiểm tra nhất quán tại phía máy chủ/giao diện.

**Việc cần làm:** thay `requireEditor()` bằng `requirePermission(...)` đúng cho từng API và bổ sung test API 401/403 cho từng quyền.

### P1 — Sai lệch số lượng nhân sự

- Tài liệu và nhiều nhãn giao diện ghi **124 nhân sự**.
- Dữ liệu và test hiện khẳng định **163 tài khoản**.
- Cần xác nhận danh sách chính thức rồi sửa đồng bộ tài liệu, giao diện và tên kiểm thử.

### P1 — Chưa có đủ bằng chứng nghiệm thu vận hành

- Chưa nghiệm thu trọn luồng bằng phiên đăng nhập QLKT thật cho toàn bộ chức năng v0.4.23.
- Chưa xác nhận đầy đủ trên dữ liệu thật tại Vercel + Turso và nhiều người dùng đồng thời.
- Chưa có bằng chứng hoàn chỉnh về nhật ký người sửa dữ liệu, sao lưu/khôi phục, rollback và giám sát lỗi.
- Chưa thực hiện kiểm thử bảo mật độc lập.

## 6. Chức năng còn thiếu theo lộ trình

- Chưa tự động xuất file **Chỉ tiêu kinh tế kỹ thuật** đầy đủ.
- Chưa có form **nước bổ sung theo ca**.
- Chưa hoàn tất nghiệm thu từng trường QLKT/PMIS bằng dữ liệu vận hành thật.
- Việc đồng bộ Google Sheet thật cần được xác nhận trong môi trường được phép, tránh ghi nhầm báo cáo chính thức.

## 7. Thứ tự đề xuất cho phiên làm việc tiếp theo

1. Giữ nguyên dữ liệu thật; tạo nhánh/phạm vi sửa riêng cho bảo mật tài khoản.
2. Loại mật khẩu rõ, thiết kế cơ chế cấp/đổi mật khẩu an toàn.
3. Sửa phân quyền từng API và viết test 401/403 theo ma trận quyền.
4. Xác nhận số lượng nhân sự chính thức là 124 hay 163; sửa tài liệu và UI.
5. Sửa lỗi TypeScript và lint cho đến khi tất cả kiểm tra đạt.
6. Chạy nghiệm thu có kiểm soát với QLKT thật, Vercel và Turso; dùng một ngày mẫu đã biết kết quả.
7. Ghi biên bản đối chiếu đầu vào, kết quả web và file Excel làm tay trước khi cho dùng chính thức.
8. Sau khi nền tảng ổn định mới phát triển tiếp file Chỉ tiêu KTKT và form nước bổ sung theo ca.

## 8. Các lệnh kiểm tra an toàn

Chạy trong `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`:

```powershell
git -c safe.directory=C:/Users/HP/Downloads/CTKTKT/ctktkt-dashboard status --short --branch
node --test tests/*.test.mjs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
git -c safe.directory=C:/Users/HP/Downloads/CTKTKT/ctktkt-dashboard diff --check
```

Không chạy migration, seed dữ liệu, commit hoặc push nếu người dùng chưa yêu cầu rõ. Trước khi sửa phải đọc file này, `docs/ACCEPTANCE.md` và kiểm tra lại working tree vì trạng thái có thể đã thay đổi.

## 9. Bổ sung sau bàn giao — Một nút đồng bộ toàn bộ BCSX

Theo yêu cầu người dùng, trang `/bcsx-report` đã được gom còn một nút **“Đồng bộ toàn bộ S1 & S2”** ở đầu trang:

1. Gọi luồng `SYNC_ALL` để lấy 7 số liệu tổng ngày cần cho BCSX: `B`, `C`, `H`, `I`, `AE`, `AF`, `AR`.
2. Kiểm tra đủ mã và đúng ngày trước khi thay đổi dữ liệu đang hiển thị.
3. Điền đồng thời số liệu tổng ngày cho cả S1 và S2.
4. Tự chuyển sang luồng `SYNC_BCSX_EVENTS` để lấy nhật ký sự kiện cho cả hai tổ máy.
5. Khi đã đủ cả hai nguồn, gọi một API `/api/bcsx-sync` để lưu cùng lượt 7 số tổng ngày và nhật ký S1/S2 bằng một batch cơ sở dữ liệu.
6. Bỏ hai nút rời “Lấy từ Dữ liệu các tháng” và “Đồng bộ sự kiện từ QLKT”.

Quy trình sử dụng là: chọn ngày, bấm một nút đồng bộ, sau đó có thể xuất ngay ba file A0/S1/S2. Hệ thống chỉ tự lưu khi đã lấy đủ 7 mã bắt buộc, đúng ngày và nhận được nhật ký của cả hai tổ máy. Phần thông số nửa giờ tiếp tục nhập tay/dán Excel vì chưa có nguồn QLKT đã xác nhận.

Đối chiếu ba template đã phát hiện và sửa lỗi thiếu mốc cuối: danh sách giờ phải có đúng **48 mốc**, gồm `00:30` đến `23:30` và dòng `23:59` tại hàng 58. Bộ kiểm thử xuất file kiểm tra riêng A0/S1/S2: template nhúng phải byte-identical với file template nguồn; toàn bộ merge, khổ in, lề, header/footer, kích thước hàng/cột và style ô phải giữ nguyên; chỉ các ô dữ liệu cho phép mới được thay đổi.

## 10. Khắc phục QLKT báo tải trang quá lâu — Tiện ích v0.4.22

Ảnh kiểm tra thực tế cho thấy luồng BCSX dừng ở bước số liệu tổng ngày với lỗi “QLKT tải trang quá lâu”. Nguyên nhân là tiện ích v0.4.21 chỉ chấp nhận `chrome.tabs` báo trạng thái `complete` trong 20 giây; QLKT có thể đã dựng DOM và dùng được nhưng tab vẫn còn trạng thái `loading`.

Phiên bản v0.4.22 kiểm tra thêm `document.readyState` và tiếp tục ngay khi DOM đạt `interactive` hoặc `complete`; giới hạn dự phòng tăng lên 60 giây. Cơ chế kiểm tra đủ trường, đúng ngày và chỉ lưu sau khi hoàn tất cả số liệu tổng ngày lẫn sự kiện S1/S2 vẫn giữ nguyên. Sau khi cập nhật web, người dùng phải tải/cập nhật gói tiện ích, bấm Reload tại `edge://extensions` hoặc `chrome://extensions`, rồi F5 trang BCSX.

## 11. BCSX một yêu cầu duy nhất và kiểm tra ngày an toàn — Tiện ích v0.4.23

Sau v0.4.22, QLKT mở được nhưng báo màn hình Sản lượng chưa chuyển đúng ngày. Nguyên nhân kỹ thuật là PrimeFaces giữ các bản sao ô ngày ẩn mang giá trị cũ, trong khi bộ đọc ngày trước đây lấy ô ngày đầu tiên trong toàn trang. Bản v0.4.23 chỉ đọc các ô ngày đang hiển thị trong hàng bộ lọc báo cáo, dùng native setter của `HTMLInputElement`, phát đủ sự kiện `input/change`, rồi luôn bấm nút cập nhật đúng vùng ngày trong mỗi lượt.

Luồng BCSX được rút từ hai yêu cầu web (`SYNC_ALL` rồi `SYNC_BCSX_EVENTS`) thành một yêu cầu `SYNC_BCSX`: chỉ đọc Sản lượng, Nhiên liệu và Vận hành; màn hình Vận hành không còn bị đọc hai lần. Tiện ích tái sử dụng tab QLKT đúng URL nếu đang mở, kiểm tra đúng ngày ở từng màn hình, đủ đúng 7 mã `B/C/H/I/AE/AF/AR`, nhận đủ hai danh sách sự kiện rồi mới trả một gói kết quả. Web chỉ cập nhật giao diện và lưu batch sau khi toàn bộ gói qua kiểm tra; bất kỳ nguồn nào sai ngày/thiếu mã đều dừng mà không ghi dữ liệu.

## 12. Cập nhật ngày 19/09/2026: Phân quyền CTKTKT, Email báo cáo, Đồng bộ PMIS 02-PĐ & Tách biệt Mục 2 BCSX

Chi tiết bàn giao xem tại `docs/HANDOFF_CODEX_2026_09_19.md`. Các điểm chính:
1. **Phân quyền & Tái cấu trúc `/ctktkt-report`**: 7 cương vị vận hành, 6 cụm tab, kiểm tra quyền chặt chẽ ở cả client lẫn server.
2. **Bỏ hộp thoại confirm**: Bỏ toàn bộ `window.confirm` trên web theo yêu cầu người dùng.
3. **Báo cáo Email hàng ngày**: Chiết xuất tự động hơn 22 chỉ số từ file chỉ tiêu KTKT, xuất bảng Times New Roman giống ảnh mẫu, nút Copy HTML/Text 1 chạm.
4. **Multi-cell Copy/Paste & Bàn phím**: Hỗ trợ copy dán nhiều ô dạng ma trận từ Excel và điều hướng bằng phím mũi tên `↑↓←→`, Tab, Enter.
5. **Đồng bộ PMIS & 02-PĐ Duyên Hải 1 từ QLKT**: Trích xuất 18 chỉ tiêu hàng "Duyên Hải 1" (`C181:T181`) và sản lượng PMIS S1/S2 (`J157, K157, J158, K158`) qua tiện ích mở rộng.
6. **Mục 2 BCSX lấy từ file Chỉ tiêu KTKT**: Bỏ đồng bộ Mục 2 từ QLKT để tránh trùng lặp; Mục 2 liên kết trực tiếp từ CTKTKT và hỗ trợ nạp lại/đồng bộ 2 chiều.
7. **Kiểm thử & Build**: 78/78 tests vượt qua (100%), `npm run build` hoàn thành với mã 0.

## 13. Cập nhật ngày 20/09/2026 — Đối chiếu công thức file Chỉ tiêu KTKT gốc

Đã đối chiếu các nhóm công thức mà trang `/ctktkt-report` tự tính với file gốc `CHỈ TIÊU KINH TẾ KỸ THUẬT 17.09.2026.xls`, không suy diễn theo tên hiển thị:

1. **Dầu S1/S2**: sửa từ phép trừ sai `F1 - F2` tại cùng thời điểm sang đúng công thức Excel `ΔF1 - ΔF2`. Kỳ 06h lấy chỉ số 24h của ngày D-1; các kỳ sau lấy mốc ngay trước đó trong ngày.
2. **Than tiêu thụ**: giữ chênh lệch tổng 12 cân theo ba ca, đồng thời cộng đúng các ô hiệu chỉnh `W/Y/AA28` (S1) và `AG/AI/AK28` (S2). Khi xuất Excel, công thức chênh lệch không còn chứa hằng số hiệu chỉnh cứng; số hiệu chỉnh nằm riêng trong các ô nhập để không cộng hai lần.
3. **Quy ẩm và than trộn**: chuyển đúng tỷ lệ Sub-bitum sang `AL87:AL92`, độ ẩm Sub-bitum sang `AO87:AO92`; áp dụng chuỗi công thức `AM:AR` của Excel và cơ sở ẩm chuẩn 8,5%.
4. **Nhiệt trị và suất hao nhiệt**: dùng một nhiệt trị ngày chung của nhà máy theo `AS86/AT86/AT87`, sau đó tính SHN S1/S2 như `AV87/AV88`; không còn tính nhiệt trị riêng từng tổ máy theo mô hình rút gọn.
5. **Hơi, NH3, TKĐ DCS và PMIS**: đã kiểm tra lại cấu trúc công thức. Hơi là lũy kế rồi trừ mốc trước; NH3 là tổng tồn ba bồn, `tồn 0h + nhập - tồn 24h`, rồi chia sản lượng; TKĐ DCS là tổng các nhánh tương ứng; PMIS `L157/L158 = J-K`. NH3 đã được gom về một hàm dùng chung cho giao diện và email.

### Bằng chứng đối chiếu ngày 17/09/2026

- Than quy ẩm S1: `5.341,11098688518 t`; S2: `5.349,81764480845 t`.
- Nhiệt trị chung: `20.021,5934392878 kJ/kg`.
- SHN tinh S1: `10.569,4584381209 kJ/kWh`; S2: `10.611,2296030078 kJ/kWh`.
- Dầu S1 theo 6 kỳ: `-1,10; 0; -1,00; 0; -0,70; 0`; S2: `-183,10; 0; -195,80; 0; -199,12; 0` — đúng các ô `W15:AB15` và `AG15:AL15` của Excel gốc.
- Hơi S1 theo 6 kỳ: `8.520,17; 5.586,53; 5.556,48; 6.413,03; 6.717,28; 2.789,06 t`; S2: `8.072,46; 5.521,55; 5.411,51; 6.270,16; 6.458,53; 2.810,51 t`.
- NH3: tồn 24h `129,774 t`; tiêu thụ `14,391 t`; suất hao đầu cực `0,65226850383 g/kWh`; suất hao trên lưới `0,712009816048 g/kWh`.

### Kiểm tra và phần còn lại

- `node --test tests/*.test.mjs`: **79/79 đạt**.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- `npm.cmd run lint`: đạt.
- `git diff --check` trên các file thuộc phạm vi sửa: đạt. Working tree vẫn có một dòng trống cuối file trong `docs/HANDOFF_CODEX_2026_09_19.md` từ trước lượt làm việc này nên không đưa file đó vào commit.
- Cần nghiệm thu thêm trên trình duyệt bằng một ngày vận hành thật khác 17/09, đặc biệt khi có than Sub-bitum và các ô hiệu chỉnh cân than, trước khi coi kết quả là báo cáo chính thức.

## 14. Cập nhật ngày 20/09/2026 — Nhập liệu như Excel và đẩy Google Sheet một nút

### Đã làm

1. Trang `/ctktkt-report` cho phép dán một vùng nhiều hàng/nhiều cột từ Excel hoặc Google Sheets vào ô đang chọn. Dữ liệu được điền theo ma trận, tự bỏ cột tên chỉ tiêu nếu người dùng copy kèm nhãn, và hiểu cả số Việt Nam như `1.617.408,5` lẫn số kiểu `1,617,408.5`.
2. Khi bảng có xen cột tự tính hoặc ô khóa, luồng dán phân biệt hai trường hợp: vùng chỉ chứa các ô nhập tay sẽ đi qua các ô nhập được; vùng copy đủ cột hiển thị sẽ giữ đúng vị trí cột và bỏ qua ô khóa mà không làm lệch dữ liệu.
3. Các phím `←`, `→`, `↑`, `↓`, `Tab`, `Shift+Tab`, `Enter`, `Shift+Enter` chuyển giữa các ô được phép nhập; ô đích được chọn toàn bộ để có thể gõ đè ngay.
4. Nút `Đẩy Google Sheet · dd/mm/yyyy` thực hiện toàn bộ quá trình bằng một lần nhấn. Hộp xem trước và nút xác nhận lần hai đã được bỏ. Nếu máy chủ chưa có cấu hình, lần đầu người dùng nhập URL Apps Script và mã kết nối rồi bấm `Lưu và đẩy`; các lần sau chỉ cần một nút.
5. Cả API máy chủ và luồng dự phòng trên trình duyệt chỉ báo thành công khi Apps Script trả `status: ok` đúng chính số hàng đã xác định cho ngày vận hành; phản hồi `ok` của hàng khác không còn được chấp nhận.

### Kiểm tra

- `node --test tests/*.test.mjs`: **83/83 đạt**.
- `npx.cmd tsc --noEmit`: đạt.
- `npm.cmd run build`: đạt.
- `git diff --check`: các file thuộc phạm vi sửa đạt; file `docs/HANDOFF_CODEX_2026_09_19.md` vẫn có một dòng trống cuối file từ trước và không thuộc commit này.
- `npm.cmd run lint`: chưa đạt do 18 lỗi tồn tại sẵn ở các màn hình khác (`admin-users-panel`, `daily-production-table`, `water-report-client`, ...); các file sửa trong lượt này không phát sinh lỗi lint mới.
- Localhost `/login` trả HTTP 200. Công cụ kiểm thử UI không có trình duyệt khả dụng trong phiên này nên chưa tái hiện thao tác paste/arrow bằng chuột và bàn phím thật.

### Còn cần nghiệm thu có kiểm soát

1. Đăng nhập bằng tài khoản có quyền nhập CTKTKT, copy một vùng Excel mẫu rồi dán vào nhóm tương ứng; kiểm tra ô tự tính/ô khóa không bị thay đổi và lưu lại đúng ngày.
2. Tại `So sánh trực quan SHN Thực tế và PPA`, chọn một ngày đã lưu đủ dữ liệu rồi bấm `Đẩy Google Sheet` đúng một lần; đối chiếu đúng hàng/trang `DH1`. Đây là thao tác ghi báo cáo thật nên chưa tự động thực hiện trong lượt phát triển này.

## 15. Bổ sung ngày 20/09/2026 — Công suất khả dụng S1/S2

1. Bảng chi tiết của tab `So sánh trực quan SHN Thực tế và PPA` đã có thêm cột **CS khả dụng** riêng cho S1 và S2.
2. Bấm vào ngày để mở hộp `Thông số bổ sung`, nhập Công suất khả dụng S1/S2 (MW) cùng nhận xét rồi lưu một lần.
3. Hai giá trị được lưu theo ngày trong `daily_inputs` bằng mã nội bộ `PPA_CSKD_S1` và `PPA_CSKD_S2`; không cần thay đổi cấu trúc cơ sở dữ liệu hoặc chạy migration.
4. Payload Google Sheet điền `S1.csKhaDung` và `S2.csKhaDung`; NMNĐ giữ `null` vì mẫu Google Sheet không có cột công suất khả dụng chung.
5. Nút `Đẩy Google Sheet` chỉ bật khi ngày đã có kết quả PPA và đủ cả hai công suất khả dụng. API cũng kiểm tra lại và từ chối dữ liệu thiếu hoặc giá trị ngoài khoảng `0–1.000 MW`.
6. Kiểm tra: **85/85 test đạt**, TypeScript đạt, build đạt, eslint các file sửa không có lỗi (còn một cảnh báo cũ về eslint-disable trong dashboard).

Còn cần: nhập hai giá trị thật cho ngày cần báo cáo, bấm một lần `Đẩy Google Sheet`, rồi đối chiếu hai ô Công suất khả dụng trên trang `DH1`. Chưa tự ghi dữ liệu thật trong lượt phát triển để tránh thay đổi báo cáo chính thức.

### Trạng thái triển khai

- Commit tính năng: `b0158ea` (`feat(ppa): bo sung cong suat kha dung khi day Sheet`).
- Đã push lên `github/main`; SHA local và remote cùng là `b0158eae82b7c27403de781ddc4451ea3aead07f`.
- GitHub commit status `Vercel: success`; `https://ctktkt-dashboard.vercel.app/ppa-heat-rate` trả HTTP 200.
- Sau khi mở web, cần nhấn `Ctrl+F5` một lần để trình duyệt bỏ gói JavaScript cũ trước khi thử dán nhiều ô.

## 16. Cập nhật 20/09/2026 — Nạp trực tiếp BCSX S1/S2 và bổ sung quyền Nước

- Lỗi `Unexpected token 'P', "PK..." is not valid JSON` do nút cũ đọc file `.xlsx` bằng `JSON.parse`. Luồng mới nhận đồng thời đúng hai file Excel S1 và S2 qua `/api/bcsx-section1-import`, kiểm tra toàn bộ trước khi ghi.
- Hai file ngày 19/09/2026 đã qua bộ đọc mới với 19 ngày và 7.296/7.296 giá trị Mục 1 hợp lệ. Giao diện vẫn sao lưu, ghi từng ngày, đọc lại từng ô và hoàn nguyên khi lỗi; Mục 2 và Mục 3 không đổi.
- Ma trận phân quyền có thêm quyền `edit_water` và cột `Nước`. Đây là tác vụ có trang riêng trên thanh bên nhưng trước đó chưa có quyền chức năng tương ứng. Cơ chế quyền chi tiết theo cương vị tại trang Nước được giữ nguyên; quyền mới là quyền quản lý toàn trang khi Quản trị viên chủ động cấp.
- Kiểm tra: 90/90 test đạt; TypeScript, ESLint các file thay đổi và build đều đạt.
- Còn dở: chưa thực hiện lần ghi thật 7.296 giá trị trên production vì không có phiên đăng nhập người dùng. Sau deploy, người dùng chọn đồng thời hai file S1/S2 và chờ thông báo đọc lại thành công; quản trị viên lưu cột quyền `Nước`, người dùng cần đăng nhập lại để JWT nhận quyền mới.
- Đã push commit chức năng `f4cb03f` lên `github/main`; Vercel báo `success` cho SHA đầy đủ `f4cb03f8d76ebf0c5664812e40d582cf21b244df`.

## 17. Cập nhật 20/09/2026 — Utc 220 kV chỉ lấy từ S1

- Đã đổi liên kết Chỉ tiêu KTKT `M20:R20`: chỉ đọc metric E của S1, bỏ qua S2 và không còn cảnh báo chênh điện áp S1/S2.
- Đã đổi phép tạo dữ liệu BCSX A0: P/Q/P điểm bán tiếp tục cộng S1 + S2; riêng Utc 220 kV sao chép S1. Các quy tắc tổng ngày, than tồn kho và thứ tự sự kiện giữ nguyên.
- Dữ liệu mẫu và test đã cập nhật theo nguồn S1. Kết quả: 91/91 test đạt; TypeScript, ESLint phạm vi sửa và build production đều đạt.
- Commit chức năng `29d7b69` đã được push lên `github/main`; Vercel báo `success` và `/bcsx-report` phản hồi chuyển hướng đăng nhập HTTP 307 đúng cơ chế bảo vệ.
- Còn cần: người dùng `Ctrl+F5`, kiểm tra sáu ô Utc 220 kV trên Chỉ tiêu KTKT và xuất A0 để đối chiếu cột E với S1.

## 18. Cập nhật 20/09/2026 — Tổng nước ngày tự động sang Chỉ tiêu KTKT

- Đã thêm ba cột S1/S2/Tổng sau `Tái sinh hạt` tại `/water-report`. Nguồn chốt ngày là bản ghi `22h00`; chỉ tính khi có đủ ngày D và đúng ngày D-1. Công thức S1/S2 là chênh công tơ, Tổng là S1+S2.
- Excel Nước mở rộng từ 20 lên 23 cột, giữ nguyên toàn bộ cột gốc và thêm U:W cho ba tổng ngày.
- `/api/ctktkt-report` và API xuất file tự liên kết Nước vào `W72/X72/Z72` và `W73/X73/Z73`. Không ghi vào các ô công thức Y72/Y73/Y74/Z74; các công thức của mẫu gốc đã được kiểm tra tự động.
- Kiểm tra: 95/95 test đạt; TypeScript đạt; build production đạt. ESLint các file mới sạch; lệnh lint phạm vi còn báo đúng lỗi nền cũ trong hai component đã có trước lượt sửa.
- Còn cần: sau deploy nhấn `Ctrl+F5`, đối chiếu một ngày có đủ mốc 22h D-1/D trên trang Nước và file Chỉ tiêu xuất ra. Local UI chưa được nghiệm thu do tiến trình Vinext cũ giữ khóa cổng 5173 nhưng không phản hồi.
- Commit chức năng `1e24673` đã đồng bộ với `github/main`; Vercel báo `success`. `/water-report` và `/ctktkt-report` trên production phản hồi HTTP 307 về trang đăng nhập đúng cơ chế bảo vệ.

## 19. Cập nhật 20/09/2026 — Lý do hiệu chỉnh cân than S1/S2

- Giao diện Chỉ tiêu KTKT có thêm một ô ghi chú dưới dòng hiệu chỉnh cân than cho từng tổ máy. Nội dung cần nêu máy cấp nào, hiệu chỉnh cộng/trừ bao nhiêu và nguyên nhân.
- Hai trường `COAL_ADJ_NOTE_S1/S2` lưu theo ngày trong `daily_inputs`, là văn bản tối đa 500 ký tự và không làm thay đổi công thức than.
- Phân quyền theo đúng nhóm Máy nghiền S1/S2. File Excel xuất ra gắn nội dung thành comment tại W/Y/AA28 hoặc AG/AI/AK28 để truy vết ngay tại các ô hiệu chỉnh.
- Kiểm tra: 98/98 test đạt; TypeScript đạt; lint phạm vi API/thư viện/test sạch; build production đạt. Còn cần nghiệm thu lưu/nạp lại một ghi chú thật và kiểm tra comment trong Excel.
- Commit chức năng `d97e77e` đã push lên `github/main`; Vercel báo `success`, trang production phản hồi đúng cơ chế đăng nhập.

## 20. Cập nhật 21/09/2026 — Đồng bộ QLKT tập trung

- Điểm thao tác hằng ngày duy nhất là trang `/` (Dữ liệu các tháng), nút `Đồng bộ toàn bộ QLKT` và ngày mặc định D-1.
- Message mới: web `SYNC_UNIFIED` → tiện ích `SYNC_UNIFIED_QLKT` → kết quả `SYNC_UNIFIED_RESULT`.
- Gói kết quả gồm `daily`, `ppa`, `heatRate`, `events`, `pmis02Pd`; validator yêu cầu cùng ngày, đủ 4 công tơ PPA, DA:DH, B/C/F/H/I/L/AE/AF/AR và J157/K157/J158/K158/C181/D181/F181 trước khi web bắt đầu lưu.
- Web lưu qua bốn API hiện hữu: `/api/daily-inputs`, `/api/ppa-heat-rate`, `/api/bcsx-sync`, `/api/ctktkt-report`. Đây là bốn lượt ghi độc lập; nếu một nhóm lỗi, thông báo ghi rõ nhóm lỗi và các nhóm đã ghi thành công vẫn được giữ.
- Nút đồng bộ riêng theo ngày đã bỏ khỏi PPA, BCSX, PMIS và Chỉ tiêu KTKT. Đồng bộ PMIS theo khoảng ngày được giữ riêng cho nhập lịch sử.
- Tiện ích phát hành `0.4.25`; ZIP SHA-256 `4576A0EF45F702D7F7A3B9E06FF584E7E0EB86683EB9F260DCF03E7D23C7EED2`.
- Đã kiểm tra 108/108 test, TypeScript và build production. Bước tiếp theo: nghiệm thu bằng phiên QLKT thật rồi xác nhận từng trang đích; nếu một nguồn lỗi, lưu nguyên thông báo nhóm lỗi và ảnh màn hình QLKT tương ứng.

## 21. Cập nhật 21/09/2026 — Cân bằng nhiệt PrimeFaces

- Ảnh nghiệm thu `0.4.25` báo không xác định được tổ máy đang chọn. Nguyên nhân là bộ đọc chỉ dựa vào selected option của thẻ select ẩn.
- `0.4.26` nhận dạng nhiều dạng nhãn/giá trị và nhãn widget PrimeFaces; khi trạng thái ban đầu vẫn mơ hồ, tự chọn MF1 rồi MF2 thay vì dừng.
- Phát hành đã qua 108/108 test, TypeScript và build production; SHA-256 ZIP `0.4.26`: `D234F560B52215EE748829F2FF21E9FFC50B4361C591BF37ABAA8D65691E5A05`.
- Cần người dùng tải lại ZIP, thay thư mục tiện ích cũ hoặc bấm Reload, F5 web và thử lại đúng ngày 20/09/2026. Nếu còn lỗi, ảnh tiếp theo phải kèm màn hình Cân bằng nhiệt sau khi tiện ích chuyển tab để xác định cơ chế AJAX của dropdown.

## 22. Cập nhật 21/09/2026 — Bảng nhập kiểu Excel và nhập lịch sử trực tiếp

- `SpreadsheetInputBehavior` được gắn tại `app/layout.tsx`, áp dụng paste ma trận và điều hướng bàn phím cho các ô số/văn bản trên toàn ứng dụng. Các ô Chỉ tiêu có `data-cell` vẫn đi qua bộ xử lý chuyên biệt để không phá phân quyền hoặc lệch cột khóa.
- `/ctktkt-report` chỉ còn nút `Nhập dữ liệu file chỉ tiêu các tháng trước`. Endpoint `/api/ctktkt-report/history-import` nhận `.xls/.xlsx`, giới hạn 12 MB, kiểm tra đăng nhập/quyền/origin và dùng `lib/ctktkt-history-import.ts` để đọc, đối chiếu trước khi ghi.
- Chỉ `manualEntries` được gửi vào `/api/ctktkt-report`; dữ liệu liên kết BCSX/Nước không bị ghi đè. Lượt ghi có backup, read-back và rollback. API seed mẫu và hành vi tự seed khi GET/export kho trống đã bỏ.
- Bằng chứng file thật 19/09/2026: 20 ngày, 5.839 giá trị nhập tay, 1.634/1.634 công thức đạt. 109/109 test, TypeScript và build đạt. Chưa thực hiện ghi production; bước kế tiếp là nghiệm thu bằng tài khoản người dùng sau deploy.
- Commit chức năng `b7d7be3` đã push lên `github/main`; GitHub báo trạng thái Vercel `success` cho đúng SHA.

## 23. Cập nhật 21/09/2026 — Than 6A10, PMIS, đồng bộ riêng và liên kết NH3

- Cụm than Chỉ tiêu KTKT đã bỏ hoàn toàn Sub-bitum khỏi giao diện, quyền nhập và công thức. Nguồn còn lại là sáu dòng 6A10 theo S1/S2 × ba ca, quy về cơ sở ẩm 8,5%.
- `C181` dùng mặc định `1245 MW` khi thiếu dữ liệu QLKT; số Việt Nam được chuẩn hóa trước khi tính PMIS để tránh Tổng tự dùng trống do dấu phân cách.
- Yêu cầu mới thay thế mục 20: mỗi trang có nút đồng bộ riêng. Không tiếp tục dùng `SYNC_UNIFIED` trên Dữ liệu các tháng; các luồng riêng `SYNC_HEATRATE`, PPA, BCSX events và PMIS/02-PĐ được giữ độc lập.
- Dữ liệu các tháng đọc `/api/ctktkt-report` để liên kết `BN` từ tổng NH3 dùng theo mức bồn và `CN` từ lượng NH3 nhập `P72`; các ô này khóa nhập. `BQ/BR` là NH3 DCS riêng từng tổ máy, file Chỉ tiêu không có nguồn tương ứng nên không tự suy diễn.
- Kiểm tra hiện tại: 112/112 test, TypeScript và build production đạt. Kiểm tra lưu trữ bị chặn chính xác bởi thiếu `TURSO_DATABASE_URL`; chưa xác minh Turso/Vercel usage trực tiếp.
- Chưa commit/push/deploy. Cần nghiệm thu UI thật sau triển khai theo danh sách cuối mục mới trong `docs/ACCEPTANCE.md`.
## Cập nhật 2026-09-21 — Nhập file CTKTKT theo ngày

- Nút nhập lịch sử trên `/ctktkt-report` dùng ngày đang chọn và gửi `targetDate` tới `/api/ctktkt-report/history-import`.
- `lib/ctktkt-history-import.ts` tự nhận diện sheet ngày, yêu cầu sheet ngày trước để đối chiếu, chỉ trả một ngày cần nhập và chỉ gồm các ô nhập tay.
- Giao diện báo chi tiết mọi công thức chưa khớp; chỉ ghi khi kết quả Excel và web khớp 100%, sau đó đọc lại xác nhận dữ liệu nhập tay.
- Thanh chuyển cụm dùng màu nâu nhạt và lưới responsive 1/2/4/7 cột để dành thêm không gian cho bảng dữ liệu.
- Test mới: `tests/ctktkt-history-import.test.mjs` bao phủ tên sheet tiếng Việt, tên sheet ngày đầy đủ và lỗi thiếu sheet ngày trước.
# Cap nhat 23/09/2026 - HFO ngay theo chi so 24h

- Chi tieu `X - Dau FO tieu thu` lay truc tiep chenh lech chi so 24h ngay D va ngay D-1.
- S1: `(AB13_D - AB13_D-1) - (AB14_D - AB14_D-1)`; don vi tan.
- S2: `[(AL13_D - AL13_D-1) - (AL14_D - AL14_D-1)] / 1000`; doi tu kg sang tan.
- Khong yeu cau du cac moc 06h-22h de tinh chi tieu ngay; cac moc nay van duoc giu cho bang chi tiet va doi chieu Excel.

# Cap nhat 23/09/2026 - khong hien thi tieu thu HFO am

- Van tinh tong HFO bang chenh lech cong to 24h ngay D va ngay D-1 cua S1, S2.
- Neu tong chenh lech am do cong to dau ve bon tang nhieu hon cong to cap lo, chi tieu `X` tra ve 0 vi luong dau tieu thu vat ly khong the am.
- Gia tri duong trong ngay co dot dau van duoc giu nguyen; khong lay tri tuyet doi va khong dao dau.

# Cap nhat 23/09/2026 - nhap file lenh dieu do co nhieu ngay

- Khi chon ngay bao cao, bo nhap chi lay cac lenh co thoi diem bat dau trong ngay dang chon.
- Lenh bat dau truoc 24h va hoan thanh sau 0h ngay ke tiep van duoc giu nguyen trong ngay bat dau.
- Cac dong thuoc ngay khac trong cung file duoc bo qua de nguoi dung tu nhap tay khi can; khong con chan ca file vi co nhieu ngay.
