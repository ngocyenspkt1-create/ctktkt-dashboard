import test from "node:test";
import assert from "node:assert/strict";
import {
  canEditCtktktGroup,
  canEditCtktktField,
  getCtktktFieldGroup,
} from "../lib/ctktkt-permissions.ts";
import { canViewPreAdjustmentHeatRate } from "../lib/auth/session.ts";

test("Nhiệt trị trước chỉnh chỉ hiển thị cho nhóm cương vị được phép", () => {
  const allowedPositions = ["Trưởng kíp điện", "TK Lò máy", "Trưởng ca", "Kỹ thuật viên", "Lãnh đạo phân xưởng"];
  for (const position of allowedPositions) {
    assert.equal(canViewPreAdjustmentHeatRate({ role: "viewer", position, permissions: ["view_all"] }), true, position);
  }
  assert.equal(canViewPreAdjustmentHeatRate({ role: "admin", permissions: [] }), true);
  assert.equal(canViewPreAdjustmentHeatRate({ role: "viewer", position: "Thống kê", permissions: ["view_all"] }), false);
  assert.equal(canViewPreAdjustmentHeatRate({ role: "viewer", position: "Lò phó", permissions: ["view_all"] }), false);
  assert.equal(canViewPreAdjustmentHeatRate(null), false);
});

test("Cell group mapping identifies key cells correctly", () => {
  assert.equal(getCtktktFieldGroup("I35"), "kpi_summary");
  assert.equal(getCtktktFieldGroup("I36"), "kpi_summary");
  assert.equal(getCtktktFieldGroup("M9"), "tkd_trend");
  assert.equal(getCtktktFieldGroup("R10"), "tkd_trend");
  assert.equal(getCtktktFieldGroup("W8"), "tpd_tcd_power");
  assert.equal(getCtktktFieldGroup("AL11"), "tpd_tcd_power");
  assert.equal(getCtktktFieldGroup("W13"), "lo_pho_oil");
  assert.equal(getCtktktFieldGroup("AL14"), "lo_pho_oil");
  assert.equal(getCtktktFieldGroup("AK28"), "may_nghien_coal_s2");
  assert.equal(getCtktktFieldGroup("AO90"), null);
  assert.equal(getCtktktFieldGroup("X16"), "may_nghien_coal_s1");
  assert.equal(getCtktktFieldGroup("COAL_ADJ_NOTE_S1"), "may_nghien_coal_s1");
  assert.equal(getCtktktFieldGroup("AL27"), "may_nghien_coal_s2");
  assert.equal(getCtktktFieldGroup("COAL_ADJ_NOTE_S2"), "may_nghien_coal_s2");
  assert.equal(getCtktktFieldGroup("W54"), "steam_flow");
  assert.equal(getCtktktFieldGroup("N69"), "nh3_tank");
  assert.equal(getCtktktFieldGroup("P72"), "nh3_tank");
  assert.equal(getCtktktFieldGroup("M81"), null);
  assert.equal(getCtktktFieldGroup("N82"), "nh3_dcs");
  assert.equal(getCtktktFieldGroup("M49"), "td21");
  assert.equal(getCtktktFieldGroup("AJ87"), "coal_blend_pmis");
});

test("Admin & Quản đốc have full access to all CTKTKT groups", () => {
  const admin = { id: 1, username: "admin", displayName: "Admin", role: "admin", permissions: ["manage_users"] };
  const quanDoc = { id: 2, username: "qd", displayName: "Quản đốc", role: "viewer", position: "Quản đốc", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(admin, "tkd_trend"), true);
  assert.equal(canEditCtktktGroup(admin, "lo_pho_oil"), true);
  assert.equal(canEditCtktktGroup(admin, "may_nghien_coal_s1"), true);
  assert.equal(canEditCtktktField(admin, "W13"), true);

  assert.equal(canEditCtktktGroup(quanDoc, "tkd_trend"), true);
  assert.equal(canEditCtktktGroup(quanDoc, "lo_pho_oil"), true);
  assert.equal(canEditCtktktGroup(quanDoc, "may_nghien_coal_s2"), true);
});

test("Trưởng kíp điện has rights for TKD DCS, Steam, NH3, Coal Blend, Power, TD21", () => {
  const tkd = { id: 10, username: "tkd", displayName: "Trưởng kíp điện", role: "viewer", position: "Trưởng kíp điện", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(tkd, "tkd_trend"), true);
  assert.equal(canEditCtktktGroup(tkd, "steam_flow"), true);
  assert.equal(canEditCtktktGroup(tkd, "nh3_tank"), true);
  assert.equal(canEditCtktktGroup(tkd, "nh3_dcs"), true);
  assert.equal(canEditCtktktGroup(tkd, "coal_blend_pmis"), true);
  assert.equal(canEditCtktktGroup(tkd, "tpd_tcd_power"), true);
  assert.equal(canEditCtktktGroup(tkd, "td21"), true);
  assert.equal(canEditCtktktGroup(tkd, "kpi_summary"), true);

  // Không có quyền sửa dầu của Lò phó hoặc cân than của Máy nghiền
  assert.equal(canEditCtktktGroup(tkd, "lo_pho_oil"), false);
  assert.equal(canEditCtktktGroup(tkd, "may_nghien_coal_s1"), false);
  assert.equal(canEditCtktktGroup(tkd, "may_nghien_coal_s2"), false);
});

test("Trực phụ điện and Trực chính Điện have rights for Power Meters and TD21", () => {
  const tpd = { id: 20, username: "tpd", displayName: "Trực phụ điện", role: "viewer", position: "Trực phụ điện", permissions: ["view_all"] };
  const tcd = { id: 21, username: "tcd", displayName: "Trực chính Điện", role: "viewer", position: "Trực chính Điện", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(tpd, "tpd_tcd_power"), true);
  assert.equal(canEditCtktktGroup(tpd, "td21"), true);
  assert.equal(canEditCtktktGroup(tpd, "tkd_trend"), false);
  assert.equal(canEditCtktktGroup(tpd, "lo_pho_oil"), false);

  assert.equal(canEditCtktktGroup(tcd, "tpd_tcd_power"), true);
  assert.equal(canEditCtktktGroup(tcd, "td21"), true);
  assert.equal(canEditCtktktGroup(tcd, "steam_flow"), false);
});

test("Lò phó has rights for Oil meters and Startup/Shutdown", () => {
  const loPho = { id: 30, username: "lopho", displayName: "Lò phó", role: "viewer", position: "Lò phó", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(loPho, "lo_pho_oil"), true);
  assert.equal(canEditCtktktGroup(loPho, "startup_shutdown"), true);
  assert.equal(canEditCtktktGroup(loPho, "tpd_tcd_power"), false);
  assert.equal(canEditCtktktGroup(loPho, "tkd_trend"), false);
  assert.equal(canEditCtktktField(loPho, "W13"), true); // Dầu F1 S1
  assert.equal(canEditCtktktField(loPho, "W8"), false); // Công tơ MF S1
});

test("Máy nghiền has rights for Coal meters S1 & S2", () => {
  const mayNghien = { id: 40, username: "maynghien", displayName: "Máy nghiền", role: "viewer", position: "Máy nghiền", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(mayNghien, "may_nghien_coal_s1"), true);
  assert.equal(canEditCtktktGroup(mayNghien, "may_nghien_coal_s2"), true);
  assert.equal(canEditCtktktGroup(mayNghien, "lo_pho_oil"), false);
  assert.equal(canEditCtktktGroup(mayNghien, "tpd_tcd_power"), false);
  assert.equal(canEditCtktktField(mayNghien, "X16"), true);
  assert.equal(canEditCtktktField(mayNghien, "COAL_ADJ_NOTE_S1"), true);
  assert.equal(canEditCtktktField(mayNghien, "AL27"), true);
  assert.equal(canEditCtktktField(mayNghien, "COAL_ADJ_NOTE_S2"), true);
});

test("NH3 - Lò hơi phụ has rights for NH3 tank", () => {
  const vhvNh3 = { id: 50, username: "nh3", displayName: "VHV NH3", role: "viewer", position: "NH3 - Lò hơi phụ", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(vhvNh3, "nh3_tank"), true);
  assert.equal(canEditCtktktGroup(vhvNh3, "tkd_trend"), false);
  assert.equal(canEditCtktktGroup(vhvNh3, "tpd_tcd_power"), false);
  assert.equal(canEditCtktktField(vhvNh3, "N69"), true);
  assert.equal(canEditCtktktField(vhvNh3, "P72"), true);
  assert.equal(canEditCtktktGroup(vhvNh3, "nh3_dcs"), false);
  assert.equal(canEditCtktktField(vhvNh3, "M81"), false);
});

test("Lò trưởng can enter NH3 DCS but Lò phó cannot", () => {
  const loTruong = { id: 51, username: "lotruong", displayName: "Lò trưởng", role: "viewer", position: "Lò trưởng", permissions: ["view_all"] };
  const loPho = { id: 52, username: "lopho2", displayName: "Lò phó", role: "viewer", position: "Lò phó", permissions: ["view_all"] };

  assert.equal(canEditCtktktGroup(loTruong, "nh3_dcs"), true);
  assert.equal(canEditCtktktField(loTruong, "M81"), false);
  assert.equal(canEditCtktktField(loTruong, "N82"), true);
  assert.equal(canEditCtktktGroup(loPho, "nh3_dcs"), false);
  assert.equal(canEditCtktktField(loPho, "N82"), false);
});
