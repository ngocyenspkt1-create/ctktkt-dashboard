import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import { reportReadRange } from "../lib/report-read-range.ts";
import { CTKTKT_SAMPLE_2DAYS } from "../lib/ctktkt-sample-data.ts";
import { deriveDailyValuesFromCtktkt, mergeDailyInputsWithCtktkt } from "../lib/daily-source-links.ts";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
function loadTs(relative, overrides, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = { exports: {} };
  cache.set(filename, compiled);
  const localRequire = name => {
    if (name in overrides) return overrides[name];
    if (!name.startsWith(".") && !name.startsWith("@/")) return require(name);
    const base = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
    const target = [base, `${base}.ts`, `${base}/index.ts`].find(candidate => existsSync(candidate) && candidate.endsWith(".ts"));
    if (!target) throw new Error(`Missing test dependency: ${name}`);
    return loadTs(target, overrides, cache);
  };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: localRequire, Response, Request, URL, Date, Intl, console });
  return compiled.exports;
}

function fixture(authenticated = true) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE daily_inputs (operating_date TEXT, field_code TEXT, value TEXT, note TEXT DEFAULT '');
    CREATE UNIQUE INDEX uidx_daily_inputs_date_field ON daily_inputs(operating_date, field_code);
    CREATE INDEX idx_daily_inputs_date ON daily_inputs(operating_date);
    CREATE TABLE shift_readings (operating_date TEXT, unit TEXT, time_slot TEXT, metric TEXT, value TEXT);
    CREATE TABLE water_shift_logs (log_date TEXT, shift_time TEXT, water_rec_s1 REAL, water_rec_s2 REAL, resin_water_s1_24h REAL, resin_water_s2_24h REAL);`);
  const insert = db.prepare("INSERT INTO daily_inputs(operating_date,field_code,value) VALUES (?,?,?)");
  for (const [date, day] of Object.entries(CTKTKT_SAMPLE_2DAYS)) {
    for (const entry of day.manualEntries) insert.run(date, `KTKT:${entry.cell}`, entry.value);
    for (const entry of day.shiftReadings) db.prepare("INSERT INTO shift_readings VALUES(?,?,?,?,?)").run(date, entry.unit, entry.timeSlot, entry.metric, entry.value);
    insert.run(date, "F", "24"); insert.run(date, "L", "12");
    insert.run(date, "GRID_RECEIVE_S1", "3");
  }
  insert.run("2026-01-01", "F", "24"); insert.run("2026-01-01", "L", "24");
  const queries = [];
  const raw = { prepare(sql) { return { bind(...args) { return { async all() { queries.push({ sql, args }); return { results: db.prepare(sql).all(...args) }; } }; } }; } };
  const overrides = {
    "@/db": { getRawDb: () => raw },
    "@/lib/daily-input-audit": {},
    "@/lib/auth/server": { requireSession: async () => authenticated ? { ok: true } : { ok: false, response: Response.json({}, { status: 401 }) } },
    "@/lib/water-report/schema": { ensureWaterSchema: async () => {} },
  };
  const ctktkt = loadTs("app/api/ctktkt-report/route.ts", overrides);
  const daily = loadTs("app/api/daily-inputs/route.ts", overrides);
  const request = async (handler, query) => {
    const response = await handler.GET(new Request(`https://synthetic.test/?${query}`));
    return { status: response.status, body: await response.json() };
  };
  return { db, queries, ctktkt: q => request(ctktkt, q), daily: q => request(daily, q) };
}

test("day bounds retain yesterday across month/year boundaries and reject impossible dates", () => {
  assert.deepEqual(reportReadRange("2026-01", "2026-01-01", true), { from: "2025-12-31", next: "2026-01-02" });
  assert.deepEqual(reportReadRange("2028-02", "2028-02-29", true), { from: "2028-02-28", next: "2028-03-01" });
  assert.deepEqual(reportReadRange("2026-12", null, true), { from: "2026-11-30", next: "2027-01-01" });
  for (const date of ["2026-02-29", "2026-02-31", "2026-03-01", "2026-02-00", ""]) assert.equal(reportReadRange("2026-02", date, true), null);
});

test("PPA scoped reads omit the annual query but preserve every derived daily value", async t => {
  const f = fixture(); t.after(() => f.db.close());
  const full = await f.ctktkt("period=2026-09");
  assert.equal(full.status, 200);
  const hoursQueries = f.queries.filter(q => q.sql.includes('field_code AS fieldCode'));
  assert.equal(hoursQueries.length, 9);
  assert.deepEqual(hoursQueries[0].args.slice(0, 2), ["2026-01-01", "2026-02-01"]);
  assert.deepEqual(hoursQueries.at(-1).args.slice(0, 2), ["2026-09-01", "2026-10-01"]);
  assert.ok(full.body.linkedEntries.some(e => e.cell === "W68" && e.operatingDate === "2026-09-17" && Number(e.value) === 72));
  f.queries.length = 0;
  const scoped = await f.ctktkt("period=2026-09&scope=daily-links");
  assert.equal(scoped.status, 200);
  assert.equal(f.queries.length, 4);
  assert.ok(f.queries.every(q => !q.sql.includes("field_code AS fieldCode")));
  const merge = body => mergeDailyInputsWithCtktkt([], [...body.entries, ...body.linkedEntries], "2026-09");
  assert.deepEqual(merge(scoped.body), merge(full.body));
  assert.deepEqual(scoped.body.warnings, full.body.warnings);
});

test("BCSX day scope preserves production/coal and previous-day inputs without reading the whole month", async t => {
  const f = fixture(); t.after(() => f.db.close());
  const full = (await f.ctktkt("period=2026-09")).body;
  f.queries.length = 0;
  const day = (await f.ctktkt("period=2026-09&date=2026-09-17&scope=daily-links")).body;
  assert.equal(f.queries.length, 4);
  assert.ok(f.queries.every(q => q.args[0] === "2026-09-16" && q.args[1] === "2026-09-18"));
  const values = body => {
    const entries = [...body.entries, ...body.linkedEntries];
    const byDay = date => Object.fromEntries(entries.filter(e => e.operatingDate === date).map(e => [e.cell, e.value]));
    return deriveDailyValuesFromCtktkt(byDay("2026-09-17"), byDay("2026-09-16"));
  };
  assert.deepEqual(values(day), values(full));
  const daily = await f.daily("period=2026-09&date=2026-09-17");
  assert.equal(daily.status, 200);
  assert.ok(daily.body.entries.length > 0 && daily.body.entries.every(e => e.operatingDate === "2026-09-17"));
});

test("new read scopes retain authentication and reject invalid bounds before querying", async t => {
  const denied = fixture(false); t.after(() => denied.db.close());
  assert.equal((await denied.ctktkt("period=2026-09&scope=daily-links")).status, 401);
  assert.equal((await denied.daily("period=2026-09&date=2026-09-17")).status, 401);
  assert.equal(denied.queries.length, 0);
  const f = fixture(); t.after(() => f.db.close());
  for (const query of ["period=2026-09&date=2026-09-31", "period=2026-09&date=2026-08-31", "period=2026-09&scope=unknown"]) assert.equal((await f.ctktkt(query)).status, 400);
  assert.equal(f.queries.length, 0);
});

test("field/date index changes the annual query plan and retains identical results; migration is repeatable", t => {
  const f = fixture(); t.after(() => f.db.close());
  const sql = "SELECT operating_date,field_code,value FROM daily_inputs WHERE operating_date>=? AND operating_date<? AND field_code IN (?,?,?,?,?)";
  const args = ["2026-01-01", "2026-10-01", "F", "L", "CS", "CT", "CU"];
  const sorted = rows => rows.map(row => JSON.stringify(row)).sort();
  const before = sorted(f.db.prepare(sql).all(...args));
  const migration = readFileSync(new URL("../docs/database/quota-read-index.sql", import.meta.url), "utf8");
  f.db.exec(migration); f.db.exec(migration);
  assert.deepEqual(sorted(f.db.prepare(sql).all(...args)), before);
  assert.match(f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join(" "), /idx_daily_inputs_field_date.*field_code=\?.*operating_date>\?/);
});
