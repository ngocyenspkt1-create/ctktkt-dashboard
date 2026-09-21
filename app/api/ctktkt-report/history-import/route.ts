import { getSessionUser } from "@/lib/auth/server";
import { buildCtktktHistoryImportPackage } from "@/lib/ctktkt-history-import";
import { canEditAnyCtktktField } from "@/lib/ctktkt-permissions";

const maxFileBytes = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canEditAnyCtktktField(user)) return Response.json({ error: "Tài khoản chưa có quyền nhập Chỉ tiêu KTKT." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Hãy chọn một file Chỉ tiêu KTKT.");
    if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Chỉ chấp nhận file .xlsx hoặc .xls của Chỉ tiêu KTKT.");
    if (file.size <= 0 || file.size > maxFileBytes) throw new Error("File trống hoặc vượt quá 12 MB.");
    const result = await buildCtktktHistoryImportPackage(file.name, await file.arrayBuffer());
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không đọc được file Chỉ tiêu KTKT." }, { status: 400 });
  }
}
