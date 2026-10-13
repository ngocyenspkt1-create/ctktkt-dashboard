import { hasPermission, isAdminUser, type SessionUser } from "./auth/session.ts";

export const WORK_STATUSES = { submitted: "Chờ xem xét", reviewed: "Đã xem xét", assigned: "Chưa tiếp nhận", in_progress: "Đang thực hiện", pending_review: "Chờ xác nhận", completed: "Hoàn thành", cancelled: "Đã hủy" } as const;
export type WorkStatus = keyof typeof WORK_STATUSES;
export type WorkMember = { id: number; displayName: string; position: string };
export type WorkContent = { id: string; text: string };
export type WorkItem = {
  id: string; version: number; kind: "source" | "task"; sourceType: "meeting" | "request";
  title: string; description: string; sourceDate: string; sourceId: string | null; meetingChair?: string;
  contentSections?: WorkContent[]; sourceContentId?: string | null;
  deletedAt?: string | null;
  creatorId: number; creatorName: string; assigneeId: number | null; collaboratorIds: number[];
  startDate: string; dueDate: string; reportEveryDays: number; lastReportDate: string | null;
  status: WorkStatus; progress: number; priority: "normal" | "high"; createdAt: string; updatedAt: string;
};
export type WorkEvent = { id: string; itemId: string; actorId: number; actorName: string; action: string; text: string; createdAt: string; snapshot: WorkItem };
export class WorkError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
export function pxDepartment(value: unknown) { return ["vận hành 1", "pxvh1", "phân xưởng vận hành 1"].includes(String(value || "").trim().toLocaleLowerCase("vi-VN")); }
export function canManageWork(user: SessionUser) { return hasPermission(user, "manage_work_px"); }
export function canEditWorkSource(user: SessionUser) {
  const position = (user.position || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
  return canAccessWork(user) && (canManageWork(user) || ["quản đốc", "phó quản đốc"].includes(position));
}
// Every authenticated active account can participate; management stays explicitly granted.
export function canAccessWork(user: SessionUser) { return Number.isSafeInteger(user.id) && user.id > 0 && !user.mustChangePassword; }
export function matchesWorkMember(member: WorkMember, query: string) {
  const normalize = (value: string) => value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  return normalize(`${member.displayName} ${member.position}`).includes(normalize(query.trim()));
}
export function canReadWork(user: SessionUser, item: WorkItem) { return canAccessWork(user) && (canManageWork(user) || (item.kind === "source" && canEditWorkSource(user)) || item.creatorId === user.id || item.assigneeId === user.id || item.collaboratorIds.includes(user.id)); }
export function isWorkAdmin(user: SessionUser) { return isAdminUser(user); }
export function workToday(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function validWorkDate(value: unknown): value is string { return typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
function text(value: unknown, label: string, max: number, required = true) { if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new WorkError(`${label} phải có nội dung và tối đa ${max.toLocaleString("vi-VN")} ký tự.`); return value.trim(); }
export function workContents(item: WorkItem): WorkContent[] {
  return item.contentSections?.length ? item.contentSections : [{ id: "legacy", text: item.description }];
}
function validateContents(value: unknown): WorkContent[] {
  if (!Array.isArray(value) || !value.length || value.length > 50) throw new WorkError("Cuộc họp phải có từ 1 đến 50 nội dung.");
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) || seen.has(entry.id)) throw new WorkError("Mã nội dung không hợp lệ hoặc bị trùng.");
    seen.add(entry.id);
    return { id: entry.id, text: text(entry.text, `Nội dung ${index + 1}`, 10000) };
  });
}
export function sourceContentLink(source: WorkItem, contentId: unknown, version: unknown) {
  if (source.kind !== "source") throw new WorkError("Nguồn phải là nội dung họp/phát sinh.");
  if (source.deletedAt) throw new WorkError("Khôi phục nội dung đã xóa trước khi phân công.", 409);
  if (version !== undefined && version !== source.version) throw new WorkError("Nội dung họp vừa thay đổi. Tải lại trước khi phân công.", 409);
  const sections = workContents(source);
  const section = sections.find(entry => entry.id === (contentId || (sections.length === 1 ? sections[0].id : null)));
  if (!section) throw new WorkError("Chọn một nội dung cụ thể của cuộc họp để phân công.");
  return { sourceId: source.id, sourceContentId: section.id, version: source.version };
}
export function validateWorkInput(body: Record<string, unknown>, kind: WorkItem["kind"]) {
  const title = text(body.title, "Tiêu đề", 250);
  const contentSections = kind === "source" && body.contentSections !== undefined ? validateContents(body.contentSections) : undefined;
  const description = text(contentSections ? contentSections.map((entry, index) => `Nội dung ${index + 1}:\n${entry.text}`).join("\n\n") : body.description, "Tổng nội dung", 10000);
  if (!validWorkDate(body.sourceDate)) throw new WorkError("Ngày nội dung không hợp lệ.");
  if (!["meeting", "request"].includes(String(body.sourceType))) throw new WorkError("Nguồn công việc không hợp lệ.");
  const meetingChair = body.sourceType === "meeting" ? text(body.meetingChair ?? "", "Người chủ trì cuộc họp", 200, false) : "";
  if (kind === "source") return { title, description, sourceDate: body.sourceDate, sourceType: body.sourceType as WorkItem["sourceType"], meetingChair, ...(contentSections ? { contentSections } : {}) };
  if (!validWorkDate(body.startDate) || !validWorkDate(body.dueDate) || body.dueDate < body.startDate) throw new WorkError("Hạn thực hiện phải từ ngày giao việc trở đi.");
  if (!Number.isSafeInteger(body.assigneeId) || Number(body.assigneeId) < 1) throw new WorkError("Chọn cá nhân chủ trì.");
  if (!Array.isArray(body.collaboratorIds) || body.collaboratorIds.length > 30 || body.collaboratorIds.some(id => !Number.isSafeInteger(id) || id < 1 || id === body.assigneeId)) throw new WorkError("Danh sách phối hợp không hợp lệ hoặc trùng người chủ trì.");
  if (!Number.isInteger(body.reportEveryDays) || Number(body.reportEveryDays) < 0 || Number(body.reportEveryDays) > 365) throw new WorkError("Chu kỳ báo cáo: 0 (không định kỳ) hoặc 1–365 ngày.");
  if (!["normal", "high"].includes(String(body.priority))) throw new WorkError("Mức ưu tiên không hợp lệ.");
  return { title, description, sourceDate: body.sourceDate, sourceType: body.sourceType as WorkItem["sourceType"], meetingChair, startDate: body.startDate, dueDate: body.dueDate, assigneeId: Number(body.assigneeId), collaboratorIds: [...new Set(body.collaboratorIds)] as number[], reportEveryDays: Number(body.reportEveryDays), priority: body.priority as WorkItem["priority"] };
}
function addDays(date: string, count: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10); }
export function nextWorkReport(item: WorkItem) {
  if (item.kind !== "task" || !item.reportEveryDays || ["completed", "cancelled", "pending_review"].includes(item.status)) return null;
  // Final report is due on the task deadline even when the cycle extends beyond it.
  if (item.lastReportDate && item.lastReportDate >= item.dueDate) return null;
  return [addDays(item.lastReportDate || item.startDate, item.reportEveryDays), item.dueDate].sort()[0];
}
export function workInMonth(item: WorkItem, month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return false;
  if (item.kind === "source") return item.sourceDate.startsWith(month);
  const start = `${month}-01`, end = addDays(`${month}-01`, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() - 1);
  const closed = ["completed", "cancelled"].includes(item.status);
  return item.startDate <= end && (item.dueDate >= start || (!closed) || workToday(new Date(item.updatedAt)) >= start);
}
export function changeWork(item: WorkItem, user: SessionUser, action: string, body: Record<string, unknown>, today: string): { item: WorkItem; text: string } {
  if (!canReadWork(user, item)) throw new WorkError("Không có quyền truy cập công việc này.", 403);
  const manager = canManageWork(user), primary = item.assigneeId === user.id, participant = primary || item.collaboratorIds.includes(user.id);
  let next = { ...item }; const note = text(body.text, "Nội dung cập nhật", 10000);
  if (item.kind === "source") {
    if (action === "delete_source" || action === "restore_source") {
      if (!canEditWorkSource(user)) throw new WorkError("Chỉ Quản đốc, Phó quản đốc hoặc lãnh đạo được cấp quyền mới được xóa/khôi phục nội dung.", 403);
      if ((action === "delete_source") === Boolean(item.deletedAt)) throw new WorkError("Trạng thái nội dung vừa thay đổi. Tải lại để kiểm tra.", 409);
      next.deletedAt = action === "delete_source" ? new Date().toISOString() : null;
      return { item: next, text: note };
    }
    if (item.deletedAt) throw new WorkError("Khôi phục nội dung trước khi chỉnh sửa.", 409);
    if (action === "edit_source") {
      if (!canEditWorkSource(user) && (item.creatorId !== user.id || item.status !== "submitted")) throw new WorkError("Chỉ sửa nội dung của mình trước khi lãnh đạo xem xét.", 403);
      next = { ...next, ...validateWorkInput({ ...body, contentSections: body.contentSections ?? item.contentSections }, "source") };
    } else if (action === "review_source" && manager) next.status = "reviewed";
    else throw new WorkError("Chỉ lãnh đạo được xem xét nội dung.", 403);
  } else if (action === "assign") {
    if (!manager) throw new WorkError("Chỉ lãnh đạo được phân công.", 403);
    if (["completed", "cancelled"].includes(item.status)) throw new WorkError("Mở lại công việc trước khi sửa phân công.", 409);
    const input = validateWorkInput(body, "task");
    const reassigned = input.assigneeId !== item.assigneeId;
    next = { ...next, ...input, ...(reassigned ? { status: "assigned" as const, progress: 0, lastReportDate: null } : {}) };
  } else if (action === "accept") {
    if (!primary) throw new WorkError("Chỉ người chủ trì được tiếp nhận.", 403);
    if (item.status !== "assigned") throw new WorkError("Công việc không ở trạng thái chờ tiếp nhận.", 409);
    next.status = "in_progress";
  } else if (action === "report" || action === "request_completion") {
    if (!participant || (action === "request_completion" && !primary)) throw new WorkError("Không có quyền báo cáo thao tác này.", 403);
    if (item.status !== "in_progress") throw new WorkError("Cần tiếp nhận công việc hoặc chờ lãnh đạo trả lại trước khi báo cáo.", 409);
    if (!Number.isInteger(body.progress) || Number(body.progress) < 0 || Number(body.progress) > 100) throw new WorkError("Tiến độ phải từ 0 đến 100%.");
    if (primary) { next.progress = action === "request_completion" ? 100 : Number(body.progress); next.lastReportDate = today; }
    if (action === "request_completion") next.status = "pending_review";
  } else if (["approve", "return", "reopen", "cancel"].includes(action)) {
    if (!manager) throw new WorkError("Chỉ lãnh đạo được phê duyệt hoặc thay đổi trạng thái.", 403);
    if (["approve", "return"].includes(action) && item.status !== "pending_review") throw new WorkError("Công việc chưa chờ xác nhận.", 409);
    if (action === "reopen" && !["completed", "cancelled"].includes(item.status)) throw new WorkError("Chỉ mở lại việc đã đóng.", 409);
    if (action === "cancel" && ["completed", "cancelled"].includes(item.status)) throw new WorkError("Công việc đã đóng.", 409);
    next.status = ({ approve: "completed", return: "in_progress", reopen: "in_progress", cancel: "cancelled" } as const)[action as "approve"];
    if (action === "reopen") { next.progress = 0; next.lastReportDate = null; }
  } else throw new WorkError("Thao tác không hợp lệ.");
  return { item: next, text: note };
}
