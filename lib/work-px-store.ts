import { canReadWork, WorkError, type WorkEvent, type WorkItem } from "./work-px.ts";
import type { SessionUser } from "./auth/session.ts";
type Db = ReturnType<typeof import("../db/index").getRawDb>;
export async function ensureWorkSchema(db: Db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS px_work_items (id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL, last_operation TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS px_work_events (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_px_work_events ON px_work_events(item_id, created_at)"),
  ]);
}
export async function listWork(db: Db, user: SessionUser) {
  const { results } = await db.prepare("SELECT data FROM px_work_items ORDER BY json_extract(data, '$.createdAt') DESC").all();
  return results.map(row => JSON.parse(String(row.data)) as WorkItem).filter(item => canReadWork(user, item));
}
export async function getWork(db: Db, id: string, user: SessionUser) {
  const row = await db.prepare("SELECT data FROM px_work_items WHERE id = ?").bind(id).first();
  const item = row ? JSON.parse(String(row.data)) as WorkItem : null;
  // Do not disclose record existence to unrelated accounts.
  if (!item || !canReadWork(user, item)) throw new WorkError("Không tìm thấy công việc hoặc không có quyền truy cập.", 404);
  return item;
}
export async function workHistory(db: Db, id: string) {
  const { results } = await db.prepare("SELECT data FROM px_work_events WHERE item_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200").bind(id).all();
  return results.map(row => JSON.parse(String(row.data)) as WorkEvent);
}
export async function saveWork(db: Db, item: WorkItem, user: SessionUser, action: string, text: string, expectedVersion: number | null, sourceGuard?: { sourceId: string; version: number }) {
  const operation = crypto.randomUUID();
  const next = { ...item, version: expectedVersion === null ? 1 : expectedVersion + 1, updatedAt: new Date().toISOString() };
  const event: WorkEvent = { id: operation, itemId: item.id, actorId: user.id, actorName: user.displayName, action, text, createdAt: next.updatedAt, snapshot: next };
  const write = expectedVersion === null
    ? sourceGuard
      ? db.prepare("INSERT INTO px_work_items (id,version,data,last_operation) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM px_work_items WHERE id = ? AND version = ?)").bind(next.id, next.version, JSON.stringify(next), operation, sourceGuard.sourceId, sourceGuard.version)
      : db.prepare("INSERT INTO px_work_items (id,version,data,last_operation) VALUES (?,?,?,?)").bind(next.id, next.version, JSON.stringify(next), operation)
    : next.kind === "source" && next.contentSections
      ? db.prepare("UPDATE px_work_items SET version = ?, data = ?, last_operation = ? WHERE id = ? AND version = ? AND NOT EXISTS (SELECT 1 FROM px_work_items child WHERE json_extract(child.data, '$.sourceId') = ? AND NOT EXISTS (SELECT 1 FROM json_each(?, '$.contentSections') section WHERE json_extract(section.value, '$.id') = COALESCE(json_extract(child.data, '$.sourceContentId'), 'legacy')))").bind(next.version, JSON.stringify(next), operation, next.id, expectedVersion, next.id, JSON.stringify(next))
      : db.prepare("UPDATE px_work_items SET version = ?, data = ?, last_operation = ? WHERE id = ? AND version = ?").bind(next.version, JSON.stringify(next), operation, next.id, expectedVersion);
  // Compare-and-swap and audit in one transaction. A losing writer adds no journal row.
  const result = await db.batch([write, db.prepare("INSERT INTO px_work_events (id,item_id,data,created_at) SELECT ?,?,?,? FROM px_work_items WHERE id = ? AND last_operation = ?").bind(operation, item.id, JSON.stringify(event), event.createdAt, item.id, operation)]);
  if (result[0].meta.changes !== 1) throw new WorkError("Nội dung vừa thay đổi hoặc mục cần xóa đã có phân công. Tải lại; giữ lại các mục đã được giao việc.", 409);
  return next;
}
