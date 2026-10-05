# NKVH → sự kiện PPA: tóm tắt 2026-10-05

- Repo: `C:\Users\HP\Downloads\CTKTKT\ctktkt-dashboard`; main, đầu phiên `29318c4`. Xem `git log -1` và trạng thái để lấy SHA hiện tại trước khi sửa. Giữ các tệp chưa theo dõi và thay đổi handoff có sẵn.
- Phạm vi: nhập sự kiện từ NKVH vào hai ô S1/S2 của tab Nhập & đồng bộ dữ liệu ngày; KHÔNG sửa công thức chỉ tiêu. Người dùng cho phép đọc tên miền NKVH qua Chrome đã đăng nhập. Không lấy/lưu mật khẩu, cookie hoặc token.
- Đã nối nút Đồng bộ NKVH S1 + S2 trong tab nhập PPA với tiện ích 0.2.0. Người dùng đã cung cấp hai JSON cấu trúc bằng tiện ích chẩn đoán cục bộ tại `C:\Users\HP\Downloads\CTKTKT\nkvh-structure-reader` (không có nội dung sự kiện).
- Nguồn mẫu: `C:\Users\HP\Downloads\nkvh-structure-list.json`, `C:\Users\HP\Downloads\nkvh-structure-detail.json`. Đã intake bằng MarkItDown vào `.analysis\nkvh-structure-*-intake.md` ngoài repo và kiểm tra JSON gốc.

## Cấu trúc đã xác nhận bằng JSON

- Host `nkvh.tpcduyenhai.com.vn`, trang danh sách `/nkvh/pages/nkvh/nkvh`, chi tiết `/nkvh/pages/nkvh/nkvh_ct`; query `path` và `idnkvh` trên các URL người dùng cung cấp.
- Bộ chọn sổ: `formContent:cbxSoNkvh_input`.
- Lò trưởng S1: `887f4695-1ce7-4232-896d-29154b1d7c59`.
- Lò trưởng S2: `5239718f-2729-480f-bb5b-7fe55a475125`.
- Máy trưởng S1: `4d434111-ab05-4bcc-a930-b6ee972fdbc7`.
- Máy trưởng S2: `9b183898-4bc9-476c-8778-0a7de6ee6126`.
- Từ ngày: `formContent:j_idt83_input`; đến ngày: `formContent:cldEnd_input`; nút Tổng hợp: `formContent:j_idt86` (các ID j_idt có thể đổi, ưu tiên kiểm tra ngữ nghĩa/headers khi chạy).
- Bảng danh sách: checkbox, Sổ Nkvh, Ca trực, Ngày, Giờ bắt đầu, Giờ kết thúc, Trạng thái, nút mở.
- Mẫu Máy trưởng S2 có 8 dòng. Nút mở dòng i: `formContent:dtNkvh:i:j_idt104`, type submit; không có href chi tiết trong dữ liệu thu được. Nút trạng thái `...:j_idt102` KHÔNG dùng để mở. Chưa xác minh cơ chế chuyển trang sau submit.
- Ca đêm ghi là `Khuya`; ngày là ngày BẮT ĐẦU ca lúc 22:00, kết thúc 06:00 hôm sau. Mẫu có Đã khóa / Đang thực hiện.
- Chi tiết: giờ bắt đầu ca mẫu `formContent:j_idt100_input` (04/10/2026 06:00), kết thúc `formContent:cldEnd_input` (04/10/2026 14:00).
- Bảng sự kiện có 3 cột: Thời gian bắt đầu, Thời gian kết thúc, Tình hình trong ca. Trang mẫu tách bảng header rỗng và bảng dữ liệu 18 dòng; phải bỏ qua header rỗng, không nhân đôi dữ liệu.
- Dòng i: bắt đầu `formContent:dt_thvh:i:j_idt155_input`, kết thúc `...:j_idt157_input`, nội dung textarea `...:j_idt159`. Đọc `.value` cho cả ba; JSON chẩn đoán chỉ có độ dài nội dung.

## Luồng yêu cầu

- Với D: Khuya D-1 (phần 00–06D), Sáng D (06–14), Chiều D (14–22), Khuya D (phần 22–24D). Hai sổ/tổ × hai tổ × bốn ca = 16 nhật ký.
- Hiển thị đầy đủ nội dung theo bốn nhóm ca và nguồn Lò/Máy, Trưởng ca tick dòng muốn lấy, xem/sửa kết quả rồi áp dụng riêng S1/S2. Không tự chọn, loại trùng hay tự ghi đè ô đã nhập.
- Dòng ngoài ngày D, thiếu giờ hoặc ca đang thực hiện cần hiển thị trạng thái để người dùng quyết định. Ô kết thúc rỗng không chứng minh sự kiện kéo dài.
- Tiếp tục dựa trên tiện ích QLKT hiện có (`browser-extension/qlkt-sync/`, bản public và gói tải về), bổ sung NKVH riêng. Cần xác minh điều khiển bộ lọc, mở nhật ký, phân trang và đọc nội dung trên phiên Chrome thật; công cụ CUA phiên trước không kết nối được Chrome, chỉ có IAB.
- PPA hiện có hai ô sự kiện, API `/api/ppa-heat-rate/notes`, mã lưu `PPA_EVENT_S1/S2`, Google payload `S1/S2.tinhHinhVanHanh`. Giới hạn 1000 ký tự hiện hữu cần xem xét UI/API cùng nhau trước khi nhập nhiều sự kiện; không cắt âm thầm.
- Trước phát hành: kiểm thử liên quan, build theo Vercel (`next build`), storage:check; xác nhận SHA remote, deployment và UI đăng nhập riêng. Không xem redirect login là kiểm chứng giao diện.

## Bản thử độc lập đã tạo

- Bản 0.2.0: nguồn chuẩn `browser-extension/nkvh-ppa/`, bản tải về `public/nkvh-ppa-extension/` + ZIP. Bản cục bộ cùng mã tại `C:\Users\HP\Downloads\CTKTKT\nkvh-ppa-test`. Cập nhật mọi bản phát hành cùng nhau. Cài bằng Load unpacked trên Chrome, giữ trang danh sách NKVH đã đăng nhập mở sẵn. Hiển thị cả hai tổ theo nhóm tổ/ca, bảng gọn Thời gian | Nội dung | Tích; thời gian mở nhật ký gốc, tooltip có nguồn Lò/Máy/trạng thái.
- Đọc trên tab riêng: chọn sổ, lọc D−1..D, mở bốn ca qua nút cột cuối (KHÔNG bấm nút trạng thái), kiểm tra tên sổ/ngày/ca trước khi mở; hỗ trợ phân trang tối đa 20 trang. Hiển thị tiến độ đủ/thiếu 16 nhật ký.
- Chỉ hiển thị khoảng giao với [00hD,00hD+1); không có kết thúc thì dùng giờ bắt đầu. Dòng hoàn toàn ngoài ngày, sai/thiếu giờ bị ẩn theo yêu cầu mới. Không tự chọn/loại trùng/cắt nội dung.
- Web: `components/nkvh-ppa-sync-button.tsx` được chèn cạnh các ô sự kiện trong `ppa-heat-rate-comparison.tsx`; channel `ctktkt-nkvh-ppa`. Bấm nút web mở tiện ích và tự đọc ngày D; tick → tổng hợp riêng S1/S2 → sửa → Đưa vào web. Chỉ điền các ô có nội dung; ô không chọn giữ nguyên. Cần lưu thông tin trên web theo luồng cũ; không tự ghi Sheet. Giới hạn 1000 ký tự/tổ máy, không cắt nội dung; đổi tick tạo lại kết quả và mất sửa tay (README có nêu).
- Kiểm tra origin/channel/requestId và ngày hiện tại; từ chối kết quả nếu web đổi ngày/quyền hoặc vượt giới hạn. Chrome storage.session chỉ giữ metadata tab/ngày/request, không nội dung sự kiện/secrets. Reload tiện ích 0.2.0 và Ctrl+F5 web để nhận bridge mới. Chỉ bật một bản NKVH.
- Chỉ dữ liệu trong bộ nhớ trang tiện ích. Không lưu secrets/nhân sự, không gửi dịch vụ ngoài. Nhật ký gốc không bị sửa.
- Kiểm thử `tests/nkvh-ppa-extension.test.mjs` + 3 tệp PPA liên quan: 26/26 đạt (lọc ngày, nguồn yêu cầu, metadata, ngày/giới hạn/nguồn apply, correlation bridge, đồng nhất source/public và PPA). Storage check: 3.38 MiB, 27680 dòng; Vercel usage/định mức tài khoản Turso chưa có quyền dashboard xác minh. Giới hạn 5GiB trong script chỉ là tham chiếu.
- Build phát hành dùng `npx.cmd next build` theo vercel.json; trên Windows cần chạy ngoài sandbox nếu SWC báo Access denied canonicalize baseUrl. Cảnh báo CSS .lg:pl-64 có sẵn. Kiểm tra deployment của SHA remote sau push. Chưa chạy tự chuyển ca và đọc nội dung trên Chrome NKVH thật; người dùng cần thử ngày 04/10/2026 và gửi tiến độ nếu lỗi. HTTP/login không chứng minh UI đăng nhập.
