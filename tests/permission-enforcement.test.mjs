import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { PERMISSIONS, PERMISSION_LABELS } from "../lib/auth/session.ts";
import { PERMISSION_MODULES } from "../lib/auth/permission-modules.ts";
import { loadCurrentUser, positionPermissions } from "../lib/auth/current-user.ts";
import { migrateLegacyPermissions } from "../lib/auth/permission-migration.ts";
import { canEditCtktktField, canEditAnyCtktktField, canEditCtktktGroup, CTKTKT_GROUP_META } from "../lib/ctktkt-permissions.ts";
import { canEditWaterField, canEditAnyWaterField, canDeleteWaterShift } from "../lib/water-report/permissions.ts";
import { canEnterChemical, CHEMICAL_CATALOG } from "../lib/chemical-usage/catalog.ts";
import { canEditDailyInput } from "../lib/auth/daily-input-permissions.ts";
import { DEFAULT_POSITIONS } from "../lib/auth/initial-users-data.ts";

function user(permissions = [], role = "viewer", position = "Trưởng kíp điện") {
  return { id: 1, username: "synthetic", displayName: "Synthetic", role, position, permissions };
}
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, role TEXT, employee_code TEXT, position TEXT, status TEXT, must_change_password INTEGER);
    CREATE TABLE position_permissions (position TEXT PRIMARY KEY, role TEXT, permissions TEXT, permissions_version INTEGER DEFAULT 1);
    INSERT INTO users VALUES (1,'synthetic','Synthetic','viewer','','Trưởng kíp điện','active',0);
    INSERT INTO position_permissions VALUES ('Trưởng kíp điện','viewer','["view_all"]',1);`);
  const statement = (sql, args = []) => ({ sql, args, bind: (...values) => statement(sql, values), first: async () => sqlite.prepare(sql).get(...args) || null, run: async () => sqlite.prepare(sql).run(...args) });
  return { sqlite, db: { prepare: sql => statement(sql) } };
}

test("Every module and detailed permission is visible and labelled", () => {
  const visible = new Set(PERMISSION_MODULES.flatMap(module => [module.permission, ...module.scopes]));
  for (const permission of PERMISSIONS) {
    assert.ok(PERMISSION_LABELS[permission], permission);
    assert.ok(permission === "view_all" || visible.has(permission), permission);
  }
  assert.equal(PERMISSION_MODULES.find(module => module.permission === "edit_ctktkt").scopes.length, Object.keys(CTKTKT_GROUP_META).length);
  assert.equal(PERMISSION_MODULES.find(module => module.permission === "edit_chemical").scopes.length, CHEMICAL_CATALOG.length);
});

test("Revoked permissions are not restored by role or position", () => {
  for (const role of ["viewer", "editor", "technician", "supervisor"]) {
    const account = user([], role, "Trưởng ca");
    assert.equal(canEditAnyCtktktField(account), false);
    assert.equal(canEditCtktktField(account, "W8"), false);
    assert.equal(canEditAnyWaterField(account), false);
    assert.equal(canEnterChemical(account, "HCL_31"), false);
  }
});

test("Detailed grants work for any position and do not spill into another group", () => {
  const account = user(["ctktkt_pmis_reports", "water_electricity", "chemical_HCL_31"], "viewer", "FGD");
  assert.equal(canEditAnyCtktktField(account), true);
  assert.equal(canEditCtktktField(account, "D181"), true);
  assert.equal(canEditCtktktField(account, "W8"), false);
  assert.equal(canEditWaterField(account, "electricity"), true);
  assert.equal(canEditWaterField(account, "water_intake"), false);
  assert.equal(canEnterChemical(account, "HCL_31"), true);
  assert.equal(canEnterChemical(account, "NAOH_31"), false);
  assert.equal(canEnterChemical(account, "UNKNOWN"), false);
});

test("Full module grants remain independent, with linked NH3 opening stock locked", () => {
  const account = user(["edit_ctktkt", "edit_water", "edit_chemical"], "viewer", "FGD");
  for (const group of Object.keys(CTKTKT_GROUP_META)) assert.equal(canEditCtktktGroup(account, group), true);
  for (const chemical of CHEMICAL_CATALOG) assert.equal(canEnterChemical(account, chemical.code), true);
  assert.equal(canEditCtktktField(account, "P73"), false);
  assert.equal(canEditDailyInput(account, "CW"), false);
});

test("PMIS, daily input, and sync permissions cannot write each other's fields", () => {
  assert.equal(canEditDailyInput(user(["sync_qlkt"]), "CW"), false);
  assert.equal(canEditDailyInput(user(["edit_pmis"]), "CW"), false);
  assert.equal(canEditDailyInput(user(["edit_pmis"]), "DA"), true);
  assert.equal(canEditDailyInput(user(["edit_daily_inputs"]), "DA"), false);
  assert.equal(canEditDailyInput(user(["edit_daily_inputs"]), "CW_NOTE"), true);
});

test("All existing positions retain their scoped KTKT, water and chemical access on conversion", () => {
  for (const position of DEFAULT_POSITIONS) {
    const old = user(position.permissions, position.role, position.position);
    const next = { ...old, permissions: migrateLegacyPermissions(old) };
    assert.deepEqual(migrateLegacyPermissions(next), next.permissions, position.position);
    assert.ok(next.permissions.every(permission => PERMISSIONS.includes(permission)));
  }
});

test("Stored legacy configuration migrates once and explicit empty permissions survive reload", async () => {
  const { sqlite, db } = database();
  const first = await loadCurrentUser(db, 1);
  assert.equal(canEditCtktktField(first, "W8"), true);
  assert.equal(canEditCtktktField(first, "W13"), false);
  assert.equal(sqlite.prepare("SELECT permissions_version FROM position_permissions").get().permissions_version, 2);
  sqlite.exec("UPDATE position_permissions SET permissions = '[]', permissions_version = 2");
  const second = await loadCurrentUser(db, 1);
  assert.deepEqual(second.permissions, []);
  assert.equal(canEditAnyCtktktField(second), false);
  assert.deepEqual(await positionPermissions(db, "Trưởng kíp điện"), []);
  sqlite.close();
});

test("Existing sessions use current role, locks, password-change state, and fail closed on malformed grants", async () => {
  const { sqlite, db } = database();
  sqlite.exec("UPDATE position_permissions SET permissions = '[]', permissions_version = 2; UPDATE users SET role = 'admin'");
  assert.equal((await loadCurrentUser(db, 1)).role, "admin");
  sqlite.exec("UPDATE users SET role = 'viewer', must_change_password = 1");
  const revoked = await loadCurrentUser(db, 1);
  assert.equal(revoked.role, "viewer");
  assert.equal(revoked.mustChangePassword, true);
  assert.deepEqual(revoked.permissions, []);
  sqlite.exec("UPDATE position_permissions SET permissions = 'not-json'");
  await assert.rejects(loadCurrentUser(db, 1));
  sqlite.exec("UPDATE users SET status = 'locked'");
  assert.equal(await loadCurrentUser(db, 1), null);
  sqlite.exec("DELETE FROM users");
  assert.equal(await loadCurrentUser(db, 1), null);
  sqlite.close();
});

test("Server guards and UI use authoritative grants, admin page is guarded, and permission saves are atomic", () => {
  const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source("lib/auth/server.ts"), /loadCurrentUser\(db, claims.id\)/);
  assert.match(source("app/admin/users/page.tsx"), /requireAdmin\(\)/);
  assert.match(source("app/api/admin/positions/route.ts"), /await db.batch\(statements\)/);
  assert.doesNotMatch(source("app/api/daily-inputs/route.ts"), /requireAnyPermission\([^)]*sync_qlkt/);
  assert.match(source("app/api/daily-inputs/route.ts"), /canEditDailyInput\(guard.user/);
  assert.doesNotMatch(source("app/api/ppa-heat-rate/notes/route.ts"), /requireAnyPermission\([^)]*sync_google_sheet/);
  assert.match(source("components/admin-users-panel.tsx"), /PERMISSION_MODULES.map/);
});

test("Water shift deletion cannot survive revocation or a partial field grant", () => {
  assert.equal(canDeleteWaterShift(user([], "supervisor", "Trưởng ca")), false);
  assert.equal(canDeleteWaterShift(user(["water_meta"], "supervisor", "Trưởng ca")), false);
  assert.equal(canDeleteWaterShift(user(["edit_water"], "supervisor", "Trưởng ca")), true);
  assert.equal(canDeleteWaterShift(user([], "admin")), true);
});
