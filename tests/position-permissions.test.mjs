import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POSITIONS, INITIAL_USERS } from "../lib/auth/initial-users-data.ts";
import { hasPermission, PERMISSIONS } from "../lib/auth/session.ts";

test("Danh sách Cương vị mặc định đủ 25 cương vị", () => {
  assert.equal(DEFAULT_POSITIONS.length, 25);
  const positionNames = new Set(DEFAULT_POSITIONS.map(p => p.position));
  assert.equal(positionNames.size, 25);
  assert.ok(positionNames.has("Quản đốc"));
  assert.ok(positionNames.has("Phó Quản đốc"));
  assert.ok(positionNames.has("Trưởng ca"));
  assert.ok(positionNames.has("Kỹ thuật viên"));
  assert.ok(positionNames.has("Lò trưởng"));
  assert.ok(positionNames.has("Máy trưởng"));
  assert.ok(positionNames.has("Trưởng kíp điện"));
  assert.ok(PERMISSIONS.includes("edit_water"));
  assert.ok(DEFAULT_POSITIONS.find(p => p.position === "Trưởng ca")?.permissions.includes("edit_water"));
});

test("Danh sách Nhân sự tích hợp đủ nhân sự PXVH1 (>= 124) và thuộc 25 cương vị", () => {
  assert.ok(INITIAL_USERS.length >= 124);
  assert.equal(INITIAL_USERS.length, 163);
  const validPositions = new Set(DEFAULT_POSITIONS.map(p => p.position));

  const usernames = new Set();
  for (const u of INITIAL_USERS) {
    assert.ok(u.username, `Thiếu username cho ${u.displayName}`);
    assert.ok(!u.username.includes(" "), `Username chứa dấu cách: ${u.username}`);
    assert.ok(!usernames.has(u.username.toLowerCase()), `Username bị trùng lặp: ${u.username}`);
    usernames.add(u.username.toLowerCase());

    assert.ok(u.displayName, `Thiếu họ tên cho ${u.username}`);
    assert.ok(u.employeeCode, `Thiếu mã NV cho ${u.username}`);
    assert.ok(validPositions.has(u.position), `Cương vị không hợp lệ cho ${u.username}: ${u.position}`);
    assert.ok(u.rawPassword.length >= 6, `Mật khẩu quá ngắn cho ${u.username}`);
  }
});

test("hasPermission: Admin luôn có toàn bộ quyền", () => {
  const adminUser = {
    id: 1,
    username: "huantth",
    displayName: "Trương Trần Hoàng Huân",
    role: "admin",
    position: "Quản đốc",
    permissions: ["view_all"],
  };

  for (const perm of PERMISSIONS) {
    assert.equal(hasPermission(adminUser, perm), true, `Admin phải có quyền ${perm}`);
  }
});

test("hasPermission: Trưởng ca có quyền BCSX, nước và xem nhưng không có manage_users", () => {
  const supervisorUser = {
    id: 142,
    username: "lenn",
    displayName: "Nguyễn Ngọc Lễ",
    role: "supervisor",
    position: "Trưởng ca",
    permissions: ["view_all", "edit_bcsx", "edit_daily_inputs", "edit_water", "sync_qlkt"],
  };

  assert.equal(hasPermission(supervisorUser, "view_all"), true);
  assert.equal(hasPermission(supervisorUser, "edit_bcsx"), true);
  assert.equal(hasPermission(supervisorUser, "edit_daily_inputs"), true);
  assert.equal(hasPermission(supervisorUser, "sync_qlkt"), true);
  assert.equal(hasPermission(supervisorUser, "edit_water"), true);
  assert.equal(hasPermission(supervisorUser, "manage_users"), false);
  assert.equal(hasPermission(supervisorUser, "edit_monthly_kpi"), false);
});

test("hasPermission: Viewer chỉ có quyền view_all", () => {
  const viewerUser = {
    id: 10,
    username: "hieunp",
    displayName: "Nguyễn Phương Hiếu",
    role: "viewer",
    position: "ESP",
    permissions: ["view_all"],
  };

  assert.equal(hasPermission(viewerUser, "view_all"), true);
  assert.equal(hasPermission(viewerUser, "edit_bcsx"), false);
  assert.equal(hasPermission(viewerUser, "edit_water"), false);
  assert.equal(hasPermission(viewerUser, "edit_monthly_kpi"), false);
  assert.equal(hasPermission(viewerUser, "manage_users"), false);
});
