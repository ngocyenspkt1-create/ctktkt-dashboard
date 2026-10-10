import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { auditedDailyBatch } from "../lib/daily-input-audit.ts";

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE daily_inputs (operating_date TEXT, field_code TEXT, value TEXT, note TEXT DEFAULT '', updated_at TEXT, UNIQUE(operating_date, field_code))");
  const prepare = (sql, args = []) => ({ sql, args, bind: (...args) => prepare(sql, args) });
  const db = { prepare, batch: async statements => {
    sqlite.exec("BEGIN");
    try { const results = statements.map(s => { const result = sqlite.prepare(s.sql).run(...s.args); return { meta: { changes: Number(result.changes) } }; }); sqlite.exec("COMMIT"); return results; }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  } };
  return { sqlite, db };
}
const user = { id: 7, username: "tester", displayName: "Test" };
const write = (db, value, note = "") => db.prepare("INSERT INTO daily_inputs (operating_date,field_code,value,note) VALUES (?,?,?,?) ON CONFLICT(operating_date,field_code) DO UPDATE SET value=excluded.value,note=excluded.note").bind("2026-10-10", "KTKT:P74", value, note);

test("audit records real changes, notes, deletion and authenticated actor; skips identical saves", async () => {
  const { sqlite, db } = setup();
  try {
    const results = await auditedDailyBatch(db, user, "ctktkt-report", [write(db, "10"), write(db, "12", "changed")]);
    assert.equal(results.length, 2);
    assert.deepEqual(results.map(result => result.meta.changes), [1, 1]);
    await auditedDailyBatch(db, user, "ctktkt-report", [write(db, "12", "changed")]);
    await auditedDailyBatch(db, user, "ctktkt-report", [db.prepare("DELETE FROM daily_inputs WHERE operating_date=? AND field_code=?").bind("2026-10-10", "KTKT:P74")]);
    const rows = sqlite.prepare("SELECT * FROM daily_input_audit ORDER BY id").all();
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(r => [r.action, r.old_value, r.new_value]), [["insert", null, "10"], ["update", "10", "12"], ["delete", "12", null]]);
    assert.equal(rows[1].new_note, "changed");
    assert.equal(rows[2].old_note, "changed");
    assert.ok(rows.every(r => r.actor_id === 7 && r.actor_username === "tester" && r.source === "ctktkt-report"));
  } finally { sqlite.close(); }
});

test("data and audit roll back together when a write fails", async () => {
  const { sqlite, db } = setup();
  try {
    await assert.rejects(auditedDailyBatch(db, user, "daily-inputs", [write(db, "10"), db.prepare("INSERT INTO missing_table VALUES (1)")]));
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM daily_inputs").get().n, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM daily_input_audit").get().n, 0);
  } finally { sqlite.close(); }
});

test("writers preserving notes record the retained note; audit failure prevents saving", async () => {
  const { sqlite, db } = setup();
  try {
    await auditedDailyBatch(db, user, "daily-inputs", [write(db, "10", "keep")]);
    const preserved = db.prepare("INSERT INTO daily_inputs (operating_date,field_code,value,note) VALUES (?,?,?,'') ON CONFLICT(operating_date,field_code) DO UPDATE SET value=excluded.value").bind("2026-10-10", "KTKT:P74", "11");
    await auditedDailyBatch(db, user, "ctktkt-report", [preserved]);
    const last = sqlite.prepare("SELECT * FROM daily_input_audit ORDER BY id DESC LIMIT 1").get();
    assert.equal(last.old_note, "keep");
    assert.equal(last.new_note, "keep");
    sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON daily_input_audit BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    await assert.rejects(auditedDailyBatch(db, user, "daily-inputs", [write(db, "999")]));
    assert.equal(sqlite.prepare("SELECT value FROM daily_inputs").get().value, "11");
  } finally { sqlite.close(); }
});
