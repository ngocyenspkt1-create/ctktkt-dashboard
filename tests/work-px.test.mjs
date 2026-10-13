import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { canAccessWork, canEditWorkSource, canManageWork, canReadWork, changeWork, matchesWorkMember, nextWorkReport, pxDepartment, sourceContentLink, validateWorkInput, workContents, workInMonth, workToday } from "../lib/work-px.ts";
import { ensureWorkSchema, getWork, listWork, saveWork, workHistory } from "../lib/work-px-store.ts";
const member = id => ({ id, username: `synthetic${id}`, displayName: `Synthetic ${id}`, role: "viewer", permissions: ["work_px"] });
const leader = { ...member(1), permissions: ["work_px", "manage_work_px"] };
const task = () => ({ id: "synthetic-task", version: 1, kind: "task", sourceType: "meeting", title: "Synthetic task", description: "Synthetic acceptance criteria", sourceDate: "2026-09-25", sourceId: null, creatorId: 1, creatorName: "Synthetic 1", assigneeId: 2, collaboratorIds: [3], startDate: "2026-09-25", dueDate: "2026-10-10", reportEveryDays: 7, lastReportDate: null, status: "assigned", progress: 0, priority: "normal", createdAt: "2026-09-25T01:00:00Z", updatedAt: "2026-09-25T01:00:00Z" });
function database() {
  const sqlite = new DatabaseSync(":memory:");
  const stmt = (sql, args = []) => ({ sql, args, bind: (...values) => stmt(sql, values), first: async () => sqlite.prepare(sql).get(...args) || null, all: async () => ({ results: sqlite.prepare(sql).all(...args) }), run: async () => { const r = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } });
  return { sqlite, db: { prepare: sql => stmt(sql), batch: async statements => { sqlite.exec("BEGIN"); try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec("COMMIT"); return results; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } } } };
}
test("All accounts can participate, own records are isolated and leadership requires explicit grant", () => {
  assert.equal(canReadWork(member(2), task()), true);
  assert.equal(canReadWork(member(3), task()), true);
  assert.equal(canReadWork(member(4), task()), false);
  assert.equal(canReadWork(leader, { ...task(), creatorId: 8 }), true);
  assert.equal(canManageWork({ ...member(2), position: "Lãnh đạo phân xưởng", role: "supervisor" }), false);
  assert.equal(canAccessWork({ ...member(2), permissions: [] }), true);
  assert.equal(canReadWork({ ...member(2), permissions: [] }, task()), true);
  assert.equal(canReadWork({ ...member(4), permissions: [] }, task()), false);
  assert.equal(canAccessWork({ ...member(2), mustChangePassword: true }), false);
  assert.equal(canManageWork({ ...leader, permissions: [] }), false);
  assert.equal(pxDepartment("Vận hành 1"), true);
  assert.equal(pxDepartment("Vận hành 2"), false);
});
test("Member search ignores Vietnamese accents and case and includes position", () => {
  const person = { id: 2, displayName: "Đặng Nguyễn Văn Hùng", position: "Kỹ thuật viên" };
  for (const query of ["dang", "NGUYEN", "Văn Hùng", "ky thuat", ""]) assert.equal(matchesWorkMember(person, query), true);
  assert.equal(matchesWorkMember(person, "khong co"), false);
});
test("Account with no module grant can report assigned work but cannot assign or approve", () => {
  const user = { ...member(2), permissions: [], position: "Đơn vị khác" };
  const accepted = changeWork(task(), user, "accept", { text: "received" }, "2026-10-13").item;
  assert.equal(changeWork(accepted, user, "report", { text: "progress", progress: 30 }, "2026-10-13").item.progress, 30);
  assert.throws(() => changeWork(accepted, user, "assign", { ...task(), text: "assign" }, "2026-10-13"), /lãnh đạo/);
  assert.throws(() => changeWork({ ...accepted, status: "pending_review" }, user, "approve", { text: "approve" }, "2026-10-13"), /lãnh đạo/);
});
test("Lifecycle requires acceptance, completion request and leader approval", () => {
  assert.throws(() => changeWork(task(), member(2), "report", { text: "report", progress: 50 }, "2026-10-01"), /tiếp nhận/);
  let item = changeWork(task(), member(2), "accept", { text: "accept" }, "2026-10-01").item;
  item = changeWork(item, member(2), "report", { text: "progress", progress: 100 }, "2026-10-01").item;
  assert.equal(item.status, "in_progress");
  assert.throws(() => changeWork(item, leader, "approve", { text: "approved" }, "2026-10-01"), /chưa chờ/);
  item = changeWork(item, member(2), "request_completion", { text: "result", progress: 100 }, "2026-10-01").item;
  assert.equal(item.status, "pending_review");
  assert.throws(() => changeWork(item, member(2), "approve", { text: "self approval" }, "2026-10-01"), /lãnh đạo/);
  assert.throws(() => changeWork(item, member(3), "request_completion", { text: "result", progress: 100 }, "2026-10-01"), /quyền/);
  item = changeWork(item, leader, "return", { text: "add evidence" }, "2026-10-01").item;
  assert.equal(item.status, "in_progress");
  item = changeWork(item, member(2), "request_completion", { text: "evidence", progress: 100 }, "2026-10-02").item;
  item = changeWork(item, leader, "approve", { text: "verified" }, "2026-10-02").item;
  assert.equal(item.status, "completed");
  assert.throws(() => changeWork(item, member(2), "report", { text: "late report", progress: 50 }, "2026-10-03"), /tiếp nhận/);
  assert.equal(changeWork(item, leader, "reopen", { text: "new evidence" }, "2026-10-03").item.status, "in_progress");
});
test("Periodic reporting ends at deadline, cooperation does not discharge primary reporting", () => {
  let item = { ...task(), status: "in_progress" };
  assert.equal(nextWorkReport(item), "2026-10-02");
  item = changeWork(item, member(3), "report", { text: "cooperation", progress: 80 }, "2026-10-02").item;
  assert.equal(item.lastReportDate, null); assert.equal(item.progress, 0);
  item = changeWork(item, member(2), "report", { text: "primary", progress: 80 }, "2026-10-09").item;
  assert.equal(nextWorkReport(item), "2026-10-10");
  assert.equal(nextWorkReport({ ...item, lastReportDate: "2026-10-10" }), null);
  assert.equal(nextWorkReport({ ...item, status: "pending_review" }), null);
  assert.equal(nextWorkReport({ ...item, reportEveryDays: 0 }), null);
  assert.equal(workToday(new Date("2026-10-12T18:00:00Z")), "2026-10-13");
});
test("Unfinished tasks carry into later months; closed tasks stop after closure month", () => {
  assert.equal(workInMonth(task(), "2026-09"), true);
  assert.equal(workInMonth(task(), "2026-10"), true);
  assert.equal(workInMonth(task(), "2026-11"), true);
  assert.equal(workInMonth({ ...task(), status: "completed", updatedAt: "2026-10-12T18:00:00Z" }, "2026-11"), false);
  assert.equal(workInMonth({ ...task(), kind: "source" }, "2026-10"), false);
  assert.equal(workInMonth(task(), "2026-08"), false);
});
test("Input validation rejects impossible dates, invalid participants and invalid cycles", () => {
  const payload = task(); assert.equal(validateWorkInput(payload, "task").assigneeId, 2);
  for (const bad of [{ dueDate: "2026-09-01" }, { sourceDate: "2026-02-30" }, { reportEveryDays: -1 }, { reportEveryDays: 366 }, { collaboratorIds: [2] }, { collaboratorIds: [1.2] }, { title: " " }, { description: "x".repeat(10001) }]) assert.throws(() => validateWorkInput({ ...payload, ...bad }, "task"));
  assert.throws(() => changeWork(task(), member(2), "accept", { text: "" }, "2026-10-01"));
  assert.throws(() => changeWork(task(), member(3), "accept", { text: "wrong actor" }, "2026-10-01"), /chủ trì/);
});
test("Meeting intake can be updated by its creator before review; one source can feed independent tasks", () => {
  const source = { ...task(), id: "synthetic-source", kind: "source", creatorId: 2, assigneeId: null, collaboratorIds: [], status: "submitted" };
  const edited = changeWork(source, member(2), "edit_source", { ...source, title: "Corrected minutes", text: "corrected" }, "2026-10-01").item;
  assert.equal(edited.title, "Corrected minutes");
  assert.throws(() => changeWork(edited, member(2), "review_source", { text: "self review" }, "2026-10-01"));
  const reviewed = changeWork(edited, leader, "review_source", { text: "reviewed" }, "2026-10-01").item;
  assert.throws(() => changeWork(reviewed, member(2), "edit_source", { ...edited, text: "changed" }, "2026-10-01"));
  const managerEdit = changeWork(reviewed, leader, "edit_source", { ...edited, title: "Clarified minutes", text: "clarified" }, "2026-10-01").item;
  assert.equal(managerEdit.title, "Clarified minutes");
  const child = { ...task(), sourceId: source.id };
  assert.equal(changeWork({ ...child, status: "in_progress" }, member(2), "report", { text: "result", progress: 50 }, "2026-10-01").item.sourceId, source.id);
  assert.equal(source.status, "submitted");
});
test("Persisted records survive reload and outsiders cannot retrieve history via item id", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); await ensureWorkSchema(db);
    await saveWork(db, task(), leader, "create_task", "assign", null);
    assert.equal((await listWork(db, member(2))).length, 1);
    assert.equal((await listWork(db, member(4))).length, 0);
    await assert.rejects(getWork(db, task().id, member(4)), e => e.status === 404);
    const row = await getWork(db, task().id, member(2));
    const changed = changeWork(row, member(2), "accept", { text: "accept" }, "2026-10-01").item;
    await saveWork(db, changed, member(2), "accept", "accept", row.version);
    assert.equal((await getWork(db, task().id, leader)).status, "in_progress");
    const history = await workHistory(db, task().id);
    assert.equal(history.length, 2); assert.equal(history[0].actorId, 2); assert.equal(history[1].snapshot.status, "assigned");
  } finally { sqlite.close(); }
});
test("Competing writers cannot overwrite or create false audit entries", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); const first = await saveWork(db, task(), leader, "create_task", "assign", null);
    await saveWork(db, { ...first, status: "in_progress" }, member(2), "accept", "accept", 1);
    await assert.rejects(saveWork(db, { ...first, dueDate: "2026-12-01" }, leader, "assign", "stale", 1), e => e.status === 409);
    assert.equal((await getWork(db, first.id, leader)).dueDate, "2026-10-10");
    assert.equal((await workHistory(db, first.id)).length, 2);
  } finally { sqlite.close(); }
});
test("Audit failure rolls back task mutation", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); await saveWork(db, task(), leader, "create_task", "assign", null);
    sqlite.exec("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON px_work_events BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    await assert.rejects(saveWork(db, { ...task(), status: "completed" }, leader, "approve", "verified", 1));
    assert.equal((await getWork(db, task().id, leader)).status, "assigned");
    assert.equal((await workHistory(db, task().id)).length, 1);
  } finally { sqlite.close(); }
});
test("Deadline adjustments preserve progress; changing primary requires new acceptance", () => {
  const item = { ...task(), status: "in_progress", progress: 80, lastReportDate: "2026-10-05" };
  const adjusted = changeWork(item, leader, "assign", { ...item, dueDate: "2026-10-31", text: "extend with reason" }, "2026-10-06").item;
  assert.equal(adjusted.status, "in_progress"); assert.equal(adjusted.progress, 80); assert.equal(adjusted.lastReportDate, "2026-10-05");
  const reassigned = changeWork(item, leader, "assign", { ...item, assigneeId: 3, collaboratorIds: [2], text: "reassign" }, "2026-10-06").item;
  assert.equal(reassigned.status, "assigned"); assert.equal(reassigned.progress, 0); assert.equal(reassigned.lastReportDate, null);
});
test("Meeting chair persists through editing and audit, while legacy and non-meeting records remain valid", async () => {
  const { sqlite, db } = database(); try {
    const source = { ...task(), kind: "source", status: "submitted", assigneeId: null, collaboratorIds: [] };
    assert.equal(validateWorkInput(source, "source").meetingChair, "");
    const input = validateWorkInput({ ...source, meetingChair: "  Synthetic chair A  " }, "source");
    assert.equal(input.meetingChair, "Synthetic chair A");
    assert.equal(validateWorkInput({ ...source, sourceType: "request", meetingChair: "Ignored" }, "source").meetingChair, "");
    assert.throws(() => validateWorkInput({ ...source, meetingChair: "x".repeat(201) }, "source"));
    await ensureWorkSchema(db);
    const saved = await saveWork(db, { ...source, ...input }, leader, "create_source", "minutes", null);
    const changed = changeWork(saved, leader, "edit_source", { ...saved, meetingChair: "Synthetic chair B", text: "correct chair" }, "2026-10-13").item;
    await saveWork(db, changed, leader, "edit_source", "correct chair", saved.version);
    assert.equal((await getWork(db, source.id, leader)).meetingChair, "Synthetic chair B");
    const history = await workHistory(db, source.id);
    assert.equal(history[0].snapshot.meetingChair, "Synthetic chair B");
    assert.equal(history[1].snapshot.meetingChair, "Synthetic chair A");
  } finally { sqlite.close(); }
});
const meeting = () => ({ ...task(), id: "synthetic-meeting", kind: "source", status: "submitted", assigneeId: null, collaboratorIds: [], contentSections: [{ id: "topic-a", text: "Synthetic first conclusion" }, { id: "topic-b", text: "Synthetic second conclusion" }] });
test("Workshop heads can edit, archive and restore meetings without acquiring task management", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db);
    const source = await saveWork(db, meeting(), leader, "create_source", "meeting", null);
    await saveWork(db, { ...task(), sourceId: source.id, sourceContentId: "topic-a" }, leader, "create_task", "assigned", null);
    for (const position of ["Quản đốc", "Phó Quản đốc"]) {
      const head = { ...member(9), permissions: [], position };
      assert.equal(canEditWorkSource(head), true); assert.equal(canManageWork(head), false);
      let current = await getWork(db, source.id, head);
      current = await saveWork(db, changeWork(current, head, "edit_source", { ...current, title: "Corrected minutes", text: "edit" }, "2026-10-13").item, head, "edit_source", "edit", current.version);
      current = await saveWork(db, changeWork(current, head, "delete_source", { text: "duplicate" }, "2026-10-13").item, head, "delete_source", "duplicate", current.version);
      assert.ok(current.deletedAt);
      assert.throws(() => sourceContentLink(current, "topic-a", current.version), e => e.status === 409);
      assert.throws(() => changeWork(current, head, "edit_source", { ...current, text: "edit" }, "2026-10-13"), e => e.status === 409);
      assert.equal((await getWork(db, task().id, leader)).status, "assigned");
      current = await saveWork(db, changeWork(current, head, "restore_source", { text: "restore" }, "2026-10-13").item, head, "restore_source", "restore", current.version);
      assert.equal(current.deletedAt, null); assert.equal(current.contentSections.length, 2);
    }
    assert.equal(canEditWorkSource({ ...member(9), position: "Trưởng ca" }), false);
    assert.throws(() => changeWork(source, member(1), "delete_source", { text: "delete own" }, "2026-10-13"), e => e.status === 403);
    const events = await workHistory(db, source.id);
    assert.equal(events.filter(event => event.action === "delete_source").length, 2);
    assert.equal(events.filter(event => event.action === "restore_source").length, 2);
  } finally { sqlite.close(); }
});
test("Separate meeting contents validate and legacy text remains one assignable content", () => {
  const input = validateWorkInput(meeting(), "source");
  assert.deepEqual(input.contentSections, meeting().contentSections);
  assert.match(input.description, /Nội dung 2/);
  const legacy = { ...task(), kind: "source" };
  assert.deepEqual(workContents(legacy), [{ id: "legacy", text: legacy.description }]);
  assert.equal(sourceContentLink(legacy, undefined, undefined).sourceContentId, "legacy");
  assert.throws(() => sourceContentLink(meeting(), undefined, undefined), /cụ thể/);
  assert.throws(() => sourceContentLink(meeting(), "topic-c", 1));
  assert.throws(() => sourceContentLink(meeting(), "topic-a", 2), e => e.status === 409);
  for (const sections of [[], [{ id: "x", text: " " }], [{ id: "x", text: "a" }, { id: "x", text: "b" }], Array.from({ length: 51 }, (_, i) => ({ id: `topic-${i}`, text: "a" })), [{ id: "a", text: "x".repeat(6000) }, { id: "b", text: "x".repeat(6000) }]]) assert.throws(() => validateWorkInput({ ...meeting(), contentSections: sections }, "source"));
});
test("Two contents create independent assignments and reordering keeps each association", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); const source = await saveWork(db, meeting(), leader, "create_source", "meeting", null);
    for (const [i, content] of source.contentSections.entries()) {
      const link = sourceContentLink(source, content.id, source.version);
      await saveWork(db, { ...task(), id: `assignment-${i}`, assigneeId: i + 2, sourceId: link.sourceId, sourceContentId: link.sourceContentId, description: content.text }, leader, "create_task", "assign", null, link);
    }
    const reordered = changeWork(source, leader, "edit_source", { ...source, contentSections: [...source.contentSections].reverse(), text: "reorder" }, "2026-10-13").item;
    await saveWork(db, reordered, leader, "edit_source", "reorder", source.version);
    assert.equal((await getWork(db, "assignment-0", leader)).sourceContentId, "topic-a");
    assert.equal((await getWork(db, "assignment-1", leader)).assigneeId, 3);
    assert.equal((await getWork(db, source.id, leader)).contentSections[0].id, "topic-b");
  } finally { sqlite.close(); }
});
test("Assigning a stale meeting snapshot fails atomically with no task or false audit", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); const source = await saveWork(db, meeting(), leader, "create_source", "meeting", null);
    const link = sourceContentLink(source, "topic-a", source.version);
    await saveWork(db, { ...source, title: "Updated meeting" }, leader, "edit_source", "update", source.version);
    await assert.rejects(saveWork(db, { ...task(), sourceId: source.id, sourceContentId: "topic-a" }, leader, "create_task", "stale assignment", null, link), e => e.status === 409);
    assert.equal((await listWork(db, leader)).length, 1);
    assert.equal((await workHistory(db, task().id)).length, 0);
  } finally { sqlite.close(); }
});
test("Deleting a content with a concurrent assignment is rejected without changing meeting or history", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); const source = await saveWork(db, meeting(), leader, "create_source", "meeting", null);
    const removing = { ...source, contentSections: [source.contentSections[1]] };
    const link = sourceContentLink(source, "topic-a", source.version);
    await saveWork(db, { ...task(), sourceId: source.id, sourceContentId: "topic-a" }, leader, "create_task", "assign", null, link);
    await assert.rejects(saveWork(db, removing, leader, "edit_source", "remove", source.version), e => e.status === 409);
    assert.equal((await getWork(db, source.id, leader)).contentSections.length, 2);
    assert.equal((await workHistory(db, source.id)).length, 1);
  } finally { sqlite.close(); }
});
test("Legacy assignments protect their original text when adding separate contents", async () => {
  const { sqlite, db } = database(); try {
    await ensureWorkSchema(db); const source = await saveWork(db, { ...meeting(), contentSections: undefined }, leader, "create_source", "legacy", null);
    await saveWork(db, { ...task(), sourceId: source.id }, leader, "create_task", "old assignment", null);
    const migrated = { ...source, contentSections: [...workContents(source), { id: "new-topic", text: "New topic" }] };
    const updated = await saveWork(db, migrated, leader, "edit_source", "add", source.version);
    await assert.rejects(saveWork(db, { ...updated, contentSections: [updated.contentSections[1]] }, leader, "edit_source", "remove original", updated.version), e => e.status === 409);
    assert.equal((await getWork(db, source.id, leader)).contentSections[0].id, "legacy");
  } finally { sqlite.close(); }
});
