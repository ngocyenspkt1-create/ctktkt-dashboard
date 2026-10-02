import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CHEMICAL_CATALOG, canEnterChemical, editableChemicalsFor } from "../lib/chemical-usage/catalog.ts";

function user(position, role = "viewer") {
  return { id: 1, username: "test", displayName: "Test", role, position, permissions: ["view_all"] };
}

test("chemical catalog matches the five normalized materials from the source sheet", () => {
  assert.deepEqual(CHEMICAL_CATALOG.map(item => item.code), ["PAC_LIQUID", "NAOCL", "NH4OH_20", "HCL_31", "NAOH_31"]);
  assert.ok(CHEMICAL_CATALOG.every(item => item.unit === "Tấn"));
  assert.ok(CHEMICAL_CATALOG.every(item => item.suggestedReasons.length > 0));
});

test("PAC and NaOCl are entered only by XLN hỗn hợp", () => {
  assert.equal(canEnterChemical(user("XLN hỗn hợp"), "PAC_LIQUID"), true);
  assert.equal(canEnterChemical(user("XLN Hổn Hợp"), "NAOCL"), true);
  assert.equal(canEnterChemical(user("Máy phó"), "PAC_LIQUID"), false);
});

test("NH4OH is entered by Máy phó", () => {
  assert.equal(canEnterChemical(user("Máy phó"), "NH4OH_20"), true);
  assert.equal(canEnterChemical(user("Trợ thủ"), "NH4OH_20"), false);
});

test("HCl and NaOH accept all positions shown in the source sheet", () => {
  for (const position of ["Trợ thủ", "Máy phó", "XLN hỗn hợp", "XLNT"]) {
    assert.equal(canEnterChemical(user(position), "HCL_31"), true, position);
    assert.equal(canEnterChemical(user(position), "NAOH_31"), true, position);
  }
  assert.equal(canEnterChemical(user("FGD"), "HCL_31"), false);
});

test("admin can enter all chemicals while an unrelated position is read-only", () => {
  assert.equal(editableChemicalsFor(user("Quản đốc", "admin")).length, CHEMICAL_CATALOG.length);
  assert.equal(editableChemicalsFor(user("FGD")).length, 0);
});

test("chemical entry is always stored for the common plant and offers an explicit other reason", () => {
  const api = readFileSync(new URL("../app/api/chemical-usage/route.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/chemical-usage-client.tsx", import.meta.url), "utf8");
  assert.match(api, /\"Chung\",\s*reference/);
  assert.doesNotMatch(api, /plantUnit\?: unknown/);
  assert.match(client, /Lý do khác…/);
  assert.match(client, /Tổ máy: <strong>Chung<\/strong>/);
});

test("chemical summary cards filter the monthly log", () => {
  const client = readFileSync(new URL("../components/chemical-usage-client.tsx", import.meta.url), "utf8");
  assert.match(client, /setFilterChemicalCode\(current => current === item\.code \? null : item\.code\)/);
  assert.match(client, /records\.filter\(record => record\.chemical_code === filterChemicalCode\)/);
  assert.match(client, /filteredRecords\.map\(record =>/);
  assert.match(client, /Xem tất cả/);
});

test("chemical records can be edited only through server-validated PUT and keep updater audit", () => {
  const api = readFileSync(new URL("../app/api/chemical-usage/route.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/chemical-usage-client.tsx", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../lib/chemical-usage/schema.ts", import.meta.url), "utf8");
  assert.match(api, /export async function PUT/);
  assert.match(api, /canEnterChemical\(user, existing\.chemical_code\)/);
  assert.match(api, /updated_by_user_id = \?/);
  assert.match(schema, /updated_by_name TEXT NOT NULL DEFAULT ''/);
  assert.match(client, /onClick=\{\(\) => startEdit\(record\)\}/);
  assert.match(client, /Lưu nội dung chỉnh sửa/);
});
