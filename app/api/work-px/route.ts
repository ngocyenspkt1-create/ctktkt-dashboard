import { getRawDb } from "@/db";
import { getSessionUser } from "@/lib/auth/server";
import { loadCurrentUser } from "@/lib/auth/current-user";
import { canAccessWork, canManageWork, changeWork, isWorkAdmin, pxDepartment, validateWorkInput, workToday, WorkError, type WorkItem } from "@/lib/work-px";
import { ensureWorkSchema, getWork, listWork, saveWork, workHistory } from "@/lib/work-px-store";

export const dynamic = "force-dynamic";
async function context() {
  const user = await getSessionUser();
  if (!user) throw new WorkError("Chưa đăng nhập.", 401);
  if (!canAccessWork(user)) throw new WorkError("Chưa được cấp quyền Công việc PXVH1. Liên hệ quản trị để cấp quyền theo cương vị.", 403);
  const db = getRawDb();
  if (!isWorkAdmin(user)) {
    const row = await db.prepare("SELECT department FROM users WHERE id = ?").bind(user.id).first();
    if (!pxDepartment(row?.department)) throw new WorkError("Mục này dành cho PXVH1.", 403);
  }
  await ensureWorkSchema(db);
  return { db, user };
}
function failure(error: unknown) { return Response.json({ error: error instanceof WorkError ? error.message : "Không xử lý được công việc. Hãy thử lại." }, { status: error instanceof WorkError ? error.status : 500 }); }
export async function GET(request: Request) {
  try {
    const { db, user } = await context(); const id = new URL(request.url).searchParams.get("id");
    if (id) { const item = await getWork(db, id, user); return Response.json({ item, events: await workHistory(db, id) }, { headers: { "Cache-Control": "private, no-store" } }); }
    // Only expose the minimum directory needed to assign work, within PXVH1.
    const { results } = await db.prepare("SELECT id, display_name AS displayName, position, department FROM users WHERE COALESCE(status, 'active') = 'active' ORDER BY display_name").all();
    const items = await listWork(db, user);
    const relevantIds = new Set(items.flatMap(item => [item.creatorId, item.assigneeId, ...item.collaboratorIds]));
    const members = results.filter(row => pxDepartment(row.department) && (canManageWork(user) || relevantIds.has(Number(row.id)))).map(row => ({ id: Number(row.id), displayName: String(row.displayName), position: String(row.position || "") }));
    return Response.json({ items, members, today: workToday() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    // Same-origin JSON mutations; never accept browser form submissions.
    if (!request.headers.get("content-type")?.includes("application/json")) throw new WorkError("Yêu cầu phải là JSON.", 415);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new WorkError("Nguồn yêu cầu không hợp lệ.", 403);
    const raw = await request.text(); if (raw.length > 30000) throw new WorkError("Nội dung quá lớn.", 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new WorkError("JSON không hợp lệ."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new WorkError("Nội dung không hợp lệ.");
    const { db, user } = await context();
    const checkAssignees = async (input: ReturnType<typeof validateWorkInput>) => {
      if (!("assigneeId" in input) || input.assigneeId === undefined) return;
      for (const id of [input.assigneeId, ...(input.collaboratorIds || [])]) {
        const row = await db.prepare("SELECT department FROM users WHERE id = ?").bind(id).first();
        const member = await loadCurrentUser(db, id);
        if (!row || !pxDepartment(row.department) || !member || !canAccessWork(member)) throw new WorkError("Người được phân công phải thuộc PXVH1, có tài khoản hoạt động và được cấp quyền Công việc PX.");
      }
    };
    if (body.action === "create_source" || body.action === "create_task") {
      const kind = body.action === "create_source" ? "source" : "task";
      if (kind === "task" && !canManageWork(user)) throw new WorkError("Chỉ lãnh đạo được giao việc.", 403);
      const input = validateWorkInput(body, kind); await checkAssignees(input);
      let sourceId: string | null = null;
      if (kind === "task" && body.sourceId) {
        const source = await getWork(db, String(body.sourceId), user);
        if (source.kind !== "source") throw new WorkError("Nguồn phải là nội dung họp/phát sinh.");
        sourceId = source.id;
      }
      const now = new Date().toISOString();
      const item: WorkItem = { id: crypto.randomUUID(), version: 1, kind, title: input.title, description: input.description, sourceDate: input.sourceDate, sourceType: input.sourceType, sourceId, creatorId: user.id, creatorName: user.displayName, assigneeId: "assigneeId" in input ? input.assigneeId! : null, collaboratorIds: "collaboratorIds" in input ? input.collaboratorIds! : [], startDate: "startDate" in input ? input.startDate! : input.sourceDate, dueDate: "dueDate" in input ? input.dueDate! : input.sourceDate, reportEveryDays: "reportEveryDays" in input ? input.reportEveryDays! : 0, priority: "priority" in input ? input.priority! : "normal", progress: 0, status: kind === "source" ? "submitted" : "assigned", lastReportDate: null, createdAt: now, updatedAt: now };
      return Response.json({ item: await saveWork(db, item, user, String(body.action), item.description, null) });
    }
    const item = await getWork(db, String(body.id || ""), user);
    if (body.version !== item.version) throw new WorkError("Công việc vừa thay đổi. Tải lại trước khi lưu.", 409);
    if (body.action === "assign") {
      if (!canManageWork(user)) throw new WorkError("Chỉ lãnh đạo được phân công.", 403);
      await checkAssignees(validateWorkInput(body, "task"));
    }
    const changed = changeWork(item, user, String(body.action), body, workToday());
    return Response.json({ item: await saveWork(db, changed.item, user, String(body.action), changed.text, item.version) });
  } catch (error) { return failure(error); }
}
