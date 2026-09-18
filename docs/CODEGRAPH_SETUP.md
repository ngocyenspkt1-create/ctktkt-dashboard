# CodeGraph — công cụ hiểu code cho AI agent (đã áp dụng cho dự án này)

Nguồn: https://github.com/codegraph-ai/CodeGraph

CodeGraph là 1 MCP server dựng "biểu đồ code" (function, class, import, ai gọi ai) cho dự án, giúp AI (Claude Code, Cursor...) trả lời nhanh và chính xác các câu hỏi kiểu "hàm này ai gọi?", "sửa hàm này thì vỡ chỗ nào?", "module này có bao nhiêu chỗ phức tạp?"... thay vì phải grep/đọc từng file.

## Đã thêm vào dự án

- `.mcp.json` — khai báo MCP server `codegraph` cho Claude Code, tự chạy khi mở dự án này bằng Claude Code (không ảnh hưởng tới Cowork/web hiện tại — Cowork không đọc file này).
- `.claude/agents/codegraph.md` — 1 "subagent" chuyên biệt Claude Code có thể gọi khi cần phân tích cấu trúc code (ai gọi hàm nào, ảnh hưởng khi sửa, tóm tắt module...).

## Cần làm 1 lần trên máy bạn để dùng được

CodeGraph là 1 chương trình engine riêng (viết bằng Rust), không đi kèm sẵn trong dự án — cần cài 1 lần:

```
npm install -g @astudioplus/codegraph-mcp
```

Lệnh này tự tải engine đúng cho Windows của bạn. Sau khi cài xong, mở dự án này bằng **Claude Code** (không phải phiên Cowork trên web) thì công cụ `codegraph` sẽ tự kết nối (nhờ file `.mcp.json` vừa thêm). Lần đầu mở, nó quét toàn bộ dự án (khoảng vài chục giây), các lần sau chỉ cập nhật phần thay đổi.

## Lưu ý

- Phiên làm việc Cowork (trên claude.ai) hiện tại **không dùng được** CodeGraph — công cụ này chỉ chạy khi bạn dùng Claude Code (dòng lệnh) hoặc các IDE có cài extension CodeGraph (VS Code, JetBrains) trỏ vào thư mục dự án trên máy bạn.
- Nếu muốn dùng ngay trong VS Code: cài extension `aStudioPlus.codegraph` từ marketplace, mở thư mục `ctktkt-dashboard`, extension sẽ hỏi tải engine (giống bước `npm install -g` ở trên nhưng qua giao diện).
- Không cần cấu hình gì thêm — `.mcp.json` đã trỏ sẵn `--workspace .` vào đúng thư mục dự án.
