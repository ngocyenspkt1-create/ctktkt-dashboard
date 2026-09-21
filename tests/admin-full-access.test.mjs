import test from "node:test";
import assert from "node:assert/strict";
import { CTKTKT_INPUT_FIELDS } from "../lib/ctktkt-fields.generated.ts";
import {
  canEditAnyCtktktField,
  canEditCtktktField,
  getEditableCtktktGroups,
} from "../lib/ctktkt-permissions.ts";
import { hasPermission, isAdminUser, PERMISSIONS } from "../lib/auth/session.ts";
import { canEditAnyWaterField, canEditWaterField } from "../lib/water-report/permissions.ts";

const admin = {
  id: 1,
  username: "admin",
  displayName: "Quản trị viên",
  role: "admin",
  position: "Quản đốc",
  permissions: [],
};

test("Admin has every application permission even when its permission list is empty", () => {
  assert.equal(isAdminUser(admin), true);
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission(admin, permission), true, `Admin must have ${permission}`);
  }
});

test("Admin can edit every CTKTKT input field and field group", () => {
  assert.equal(canEditAnyCtktktField(admin), true);
  for (const field of CTKTKT_INPUT_FIELDS) {
    assert.equal(canEditCtktktField(admin, field.cell), true, `Admin must edit ${field.cell}`);
  }
  assert.deepEqual(getEditableCtktktGroups(admin).sort(), [
    "coal_blend_pmis",
    "kpi_summary",
    "lo_pho_oil",
    "may_nghien_coal_s1",
    "may_nghien_coal_s2",
    "nh3_tank",
    "startup_shutdown",
    "steam_flow",
    "td21",
    "tkd_trend",
    "tpd_tcd_power",
  ]);
});

test("Admin can edit every water-report field group", () => {
  assert.equal(canEditAnyWaterField(admin), true);
  for (const group of ["meta", "electricity", "water_intake", "resin_water"]) {
    assert.equal(canEditWaterField(admin, group), true, `Admin must edit ${group}`);
  }
});

test("A delegated system manager receives the same full-access contract", () => {
  const delegatedAdmin = {
    ...admin,
    role: "viewer",
    permissions: ["manage_users"],
  };

  assert.equal(isAdminUser(delegatedAdmin), true);
  assert.equal(canEditAnyCtktktField(delegatedAdmin), true);
  assert.equal(canEditAnyWaterField(delegatedAdmin), true);
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission(delegatedAdmin, permission), true, `System manager must have ${permission}`);
  }
});
