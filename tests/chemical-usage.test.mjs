import assert from "node:assert/strict";
import test from "node:test";
import { CHEMICAL_CATALOG, canEnterChemical, editableChemicalsFor } from "../lib/chemical-usage/catalog.ts";

function user(position, role = "viewer") {
  return { id: 1, username: "test", displayName: "Test", role, position, permissions: ["view_all"] };
}

test("chemical catalog matches the five normalized materials from the source sheet", () => {
  assert.deepEqual(CHEMICAL_CATALOG.map(item => item.code), ["PAC_LIQUID", "NAOCL", "NH4OH_20", "HCL_31", "NAOH_31"]);
  assert.ok(CHEMICAL_CATALOG.every(item => item.unit === "Tấn"));
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
