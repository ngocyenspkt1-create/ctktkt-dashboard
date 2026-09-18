# Bàn giao tính năng: Nhập & Chỉnh sửa nhận xét tổ máy S1/S2 trên trang PPA Heat Rate

**Ngày bàn giao**: 18/09/2026  
**Người thực hiện**: Antigravity Assistant  
**Đối tượng tiếp nhận**: Codex / Kỹ sư bảo trì tiếp theo  
**Vấn đề / Yêu cầu người dùng**:
> *"Tôi muốn vẫn có thể nhập chỉnh sửa phần nhận xét tổ máy S1 và S2 ở trang này, ví dụ ngày 1/9 đang thiếu thì tôi có thể bổ sung"*

---

## 1. Tóm tắt trạng thái Git & File đã sửa

> ⚠️ **LƯU Ý QUAN TRỌNG VỀ GIT**:
> Các thay đổi dưới đây **ĐÃ ĐƯỢC GHI VÀO Ổ ĐĨA** nhưng **CHƯA ĐƯỢC `git commit`**.
> Hiện trạng working tree gồm 3 file sau:
> - `app/api/ppa-heat-rate/notes/route.ts`
> - `components/ppa-heat-rate-comparison.tsx`
> - `components/ppa-heat-rate-dashboard.tsx`
>
> Khi chuyển giao, bước đầu tiên hãy chạy `git status` và `git diff` để kiểm tra.

---

## 2. Vấn đề gốc tại sao trước đó không sửa/nhập được nhận xét?

Trước khi sửa:
1. **Tại Tab "Nhập & đồng bộ dữ liệu ngày" (`components/ppa-heat-rate-comparison.tsx`)**:
   - Hai ô nhập `noteS1` và `noteS2` bị bọc bên trong điều kiện `{calculation && ...}` (dòng 234 cũ). Nếu mở một ngày trong quá khứ (ví dụ ngày 01/09/2026) mà chưa chọn lại 4 file CSV công tơ hoặc chưa đồng bộ QLKT, `calculation === null` dẫn tới **toàn bộ khối nhập nhận xét S1 & S2 bị ẩn hoàn toàn**.
   - Khi chọn đổi ngày trên DateField (`onChange`), hàm `clearImport()` reset `noteS1` và `noteS2` về rỗng `""`, không hề load lại nhận xét đã lưu trong database của ngày đó.
   - Nút lưu duy nhất là `save()`, chỉ chạy khi có đủ 4 điểm đo (`selected.source && calculation`). Không có cách nào lưu riêng nhận xét!

2. **Tại Tab "So sánh trực quan" (`components/ppa-heat-rate-dashboard.tsx`)**:
   - Bảng chi tiết các ngày trong tháng có 2 cột `Nhận xét S1` và `Nhận xét S2`, nhưng trước đó chỉ hiển thị text thụ động dạng `<ExpandableNote note={row.noteS1 || ""}/>`. Người dùng nhìn thấy dòng ngày 01/09 đang trống nhận xét nhưng không có bất kỳ nút nào để bấm vào nhập hay chỉnh sửa.

3. **Tại API `app/api/ppa-heat-rate/notes/route.ts`**:
   - Trước đó chỉ dùng câu lệnh `UPDATE ppa_heat_rate_daily SET ... WHERE operating_date = ?`.
   - Nếu ngày đó chưa từng được lưu kết quả PPA (chưa có dòng trong bảng `ppa_heat_rate_daily`), câu lệnh `UPDATE` sẽ không cập nhật được bản ghi nào (`changes = 0`), dẫn tới không thể ghi nhận xét cho ngày mới.
   - Điều kiện `entry.noteS1 && entry.noteS2 ? ... : ...` không hỗ trợ tốt việc người dùng muốn xóa trắng hoặc chỉ cập nhật 1 trong 2 ghi chú.

---

## 3. Những việc ĐÃ HOÀN THÀNH

### A. Nâng cấp API `app/api/ppa-heat-rate/notes/route.ts`
- Chuyển sang cơ chế **UPSERT** an toàn:
  ```sql
  INSERT INTO ppa_heat_rate_daily (
    operating_date, source_data, source_files,
    gross_s1_kwh, net_s1_kwh, gross_s2_kwh, net_s2_kwh,
    ppa_plant, ppa_s1, ppa_s2,
    note_s1, note_s2, updated_at
  ) VALUES (?, '{}', '[]', '0', '0', '0', '0', '0', '0', '0', ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(operating_date) DO UPDATE SET
    note_s1 = excluded.note_s1,
    note_s2 = excluded.note_s2,
    updated_at = CURRENT_TIMESTAMP
  ```
- **Lợi ích**:
  - Nếu ngày đó đã có dữ liệu PPA: toàn bộ các trường đo đếm công tơ, sản lượng, suất hao nhiệt PPA được **giữ nguyên 100%**, chỉ có `note_s1`, `note_s2` và `updated_at` được cập nhật.
  - Nếu ngày đó chưa có dữ liệu PPA: tạo mới một bản ghi lưu nhận xét. Khi người dùng nạp file công tơ sau đó, lệnh INSERT PPA với ON CONFLICT sẽ ghi đè dữ liệu kỹ thuật và giữ nguyên/cập nhật nhận xét.

### B. Tab "Nhập & đồng bộ dữ liệu ngày" (`components/ppa-heat-rate-comparison.tsx`)
1. **Tự động đồng bộ nhận xét theo ngày**:
   - Thêm `useEffect` lắng nghe `[operatingDate, history]`: tìm kiếm bản ghi của ngày đang chọn trong `history`. Nếu có thì tự động điền `noteS1` và `noteS2`; nếu không có thì đặt về `""`.
2. **Khối nhận xét luôn hiển thị**:
   - Đưa khối nhận xét ra thành khối độc lập: **"4. Nhận xét & nguyên nhân chênh lệch tổ máy S1 & S2"**.
   - Bổ sung nút **"Lưu nhận xét S1 & S2"**: gọi thẳng API `/api/ppa-heat-rate/notes` với `operatingDate`, `noteS1`, `noteS2` mà không cần 4 file CSV hay điểm đo.
   - Nút **"Lưu toàn bộ kết quả ngày"** vẫn xuất hiện khi có đủ 4 điểm đo (`calculation`) để lưu trọn gói cả số liệu PPA và nhận xét.
3. **Cải tiến bảng Lịch sử trong tháng**:
   - Thêm 2 cột `Nhận xét S1` và `Nhận xét S2`.
   - Bấm vào ngày bất kỳ trong bảng sẽ lập tức kích hoạt chọn ngày đó lên form để người dùng xem và sửa nhận xét.

### C. Tab "So sánh trực quan" (`components/ppa-heat-rate-dashboard.tsx`)
1. **Kiểm tra quyền hạn**:
   - Sử dụng `useSessionUser()` và `canEdit = hasPermission(user, "edit_ppa")`.
2. **Modal chỉnh sửa nhận xét ngày (`editModal`)**:
   - Thêm popup modal cho phép xem và sửa cả nhận xét S1 và S2 cho ngày đang chọn.
   - Lưu qua API `/api/ppa-heat-rate/notes`.
   - Khi lưu thành công: cập nhật trực tiếp state `entries` trong bộ nhớ, bảng dữ liệu thay đổi ngay lập tức mà không cần F5/tải lại trang.
3. **Nút thao tác trên Bảng chi tiết theo ngày**:
   - Cột Ngày: người dùng có quyền click vào ngày để mở modal xem/sửa nhận xét.
   - Cột Nhận xét S1 & S2:
     - Nếu đã có nhận xét: hiển thị nội dung kèm nút icon bút chì ✏️ để sửa.
     - Nếu đang trống (như ngày 01/09): hiển thị nút **`+ Nhận xét`** (màu xanh cho S1, màu hổ phách cho S2) để người dùng nhận diện ngay và nhấp vào nhập bổ sung.

---

## 4. Những gì CÒN THIẾU / CẦN LÀM TIẾP CHO CODEX

1. **Kiểm tra môi trường build**:
   - Lần chạy `npm run build` cục bộ trên Windows vừa rồi bị ngắt do lỗi hệ điều hành: `Insufficient system resources exist to complete the requested service (os error 1450)` khi vite/rolldown mở đồng thời quá nhiều file trong node_modules.
   - Cần kiểm tra xem mã nguồn có lỗi lint/type nào không bằng:
     ```bash
     npx tsc --noEmit
     # hoặc kiểm tra nhanh lint
     npm run lint
     ```
2. **Kiểm thử trực tiếp trên giao diện**:
   - Đăng nhập với tài khoản có quyền `edit_ppa` (hoặc admin).
   - Truy cập `/ppa-heat-rate`:
     - **Test 1**: Vào tab "Nhập & đồng bộ dữ liệu ngày", chọn ngày `01/09/2026`. Nhập nội dung vào "Nguyên nhân chênh lệch S1" và S2. Bấm "Lưu nhận xét S1 & S2". Kiểm tra bảng lịch sử bên dưới hiển thị đúng nhận xét vừa lưu.
     - **Test 2**: Chuyển sang ngày khác rồi chọn lại `01/09/2026` xem nhận xét có tự động hiển thị lại không.
     - **Test 3**: Vào tab "So sánh trực quan", kiểm tra hàng ngày `01/09/2026` trên bảng chi tiết. Nhấp vào nút `+ Nhận xét` hoặc `✏️` hoặc nhấp vào ngày `01/09/2026`. Modal mở lên, sửa nội dung, bấm "Lưu nhận xét" và xem bảng cập nhật tức thì.
     - **Test 4**: Thử với tài khoản chỉ có quyền xem (không có `edit_ppa`): các nút lưu phải bị disable hoặc ẩn nút bút chì.
3. **Commit & Push**:
   - Chạy lệnh git để đưa code lên remote:
     ```bash
     git add app/api/ppa-heat-rate/notes/route.ts components/ppa-heat-rate-comparison.tsx components/ppa-heat-rate-dashboard.tsx docs/HANDOFF_CODEX_PPA_NOTES.md
     git commit -m "feat(ppa): cho phep nhap va chinh sua bo sung nhan xet to may S1 va S2"
     git push github main
     ```

