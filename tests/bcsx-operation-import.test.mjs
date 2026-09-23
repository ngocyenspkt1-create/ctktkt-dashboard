import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildQlktOperationWorkbook, classifyOperationCommand, parseOperationCommandWorkbook, qlktOperationFileName } from "../lib/bcsx-operation-import.ts";

const headers = ["ID Lệnh", "Nhà máy", "Tổ máy", "Nội dung lệnh", "CS ra lệnh (MW)", "CS hoàn thành (MW)", "Thời điểm BĐTH", "Thời điểm hoàn thành", "Người ra lệnh", "Người thực hiện", "AGC", "Nhiên liệu", "Lý do lệnh", "Ghi chú ra lệnh", "Ghi chú hoàn thành", "Hoàn thành"];

async function sourceWorkbookBytes() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("All");
  worksheet.addRow([null, null, null, null, null, null, "Danh sách lệnh kết thúc"]);
  worksheet.addRow([]);
  worksheet.addRow(headers);
  const add = (id, unit, target, completed, startHour, startMinute, endHour, endMinute) => worksheet.addRow([
    id, "Duyên Hải 1", unit, "Thay đổi công suất", target, completed,
    new Date(Date.UTC(2026, 8, 19, startHour, startMinute, 20)),
    new Date(Date.UTC(2026, 8, 19, endHour, endMinute, 45)),
    "NSMO", "DH1", false, null, "Để đáp ứng cân bằng hệ thống", null, null, 1,
  ]);
  add("1", "S2", 540.7, 530, 0, 7, 0, 34);
  add("2", "S1", 540.7, 540.7, 0, 7, 0, 37);
  add("3", "S2", 622.5, 622.5, 0, 34, 1, 1);
  add("4", "S1", 622.5, 622.5, 0, 38, 1, 2);
  add("5", "S1", 517.5, 517.5, 1, 33, 2, 3);
  add("6", "S2", 517.5, 517.5, 1, 33, 2, 3);
  return workbook.xlsx.writeBuffer();
}

async function september21WorkbookBytes() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("All");
  worksheet.addRow([null, null, null, null, null, null, "Danh sách lệnh kết thúc"]);
  worksheet.addRow([]);
  worksheet.addRow(headers);
  const add = (id, unit, command, target, completedPower, completed, startHour, startMinute, endHour, endMinute) => worksheet.addRow([
    id, "Duyên Hải 1", unit, command, target, completedPower,
    new Date(Date.UTC(2026, 8, 21, startHour, startMinute)),
    new Date(Date.UTC(2026, 8, 21, endHour, endMinute)),
    "NSMO", completed ? "DH1" : null, false, null, "Để đáp ứng cân bằng hệ thống", null, null, completed,
  ]);
  add("S2-1", "S2", "Thay đổi công suất", 540.7, 540.7, 1, 14, 32, 15, 3);
  add("S2-2", "S2", "Thay đổi công suất", 622.5, 622.5, 1, 15, 4, 15, 28);
  add("S1-stop", "S1", "Ngừng tổ máy", 0, 0, 1, 7, 55, 9, 56);
  add("S1-abort-1", "S1", "Thay đổi công suất", 330.7, null, 0, 8, 33, 8, 44);
  add("S1-abort-2", "S1", "Thay đổi công suất", 225.7, null, 0, 9, 6, 9, 9);
  return workbook.xlsx.writeBuffer();
}

async function belowMinimumWithoutShutdownBytes() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("All");
  worksheet.addRow(headers);
  worksheet.addRow(["1", "Duyên Hải 1", "S1", "Thay đổi công suất", 225.7, 225.7, new Date(Date.UTC(2026, 8, 21, 1, 0)), new Date(Date.UTC(2026, 8, 21, 1, 10)), "NSMO", "DH1", false, null, "Xử lý sự cố", null, null, 1]);
  worksheet.addRow(["2", "Duyên Hải 1", "S1", "Thay đổi công suất", 435.7, 435.7, new Date(Date.UTC(2026, 8, 21, 1, 20)), new Date(Date.UTC(2026, 8, 21, 1, 30)), "NSMO", "DH1", false, null, "Khôi phục tải", null, null, 1]);
  return workbook.xlsx.writeBuffer();
}

async function shutdownDurationWorkbookBytes(durationMinutes, command = "Ngừng tổ máy") {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("All");
  worksheet.addRow(headers);
  worksheet.addRow(["1", "Duyên Hải 1", "S2", command, 0, 0, new Date(Date.UTC(2026, 6, 7, 9, 7)), new Date(Date.UTC(2026, 6, 7, 9, 7 + durationMinutes)), "NSMO", "DH1", false, null, null, null, null, 1]);
  return workbook.xlsx.writeBuffer();
}

async function multiDateMidnightWorkbookBytes() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("All");
  worksheet.addRow(headers);
  const add = (id, startAt, endAt, completedPower) => worksheet.addRow([
    id, "Duyên Hải 1", "S1", "Thay đổi công suất", completedPower, completedPower,
    startAt, endAt, "NSMO", "DH1", false, null, null, null, null, 1,
  ]);
  add("20", new Date(Date.UTC(2026, 8, 20, 22, 0)), new Date(Date.UTC(2026, 8, 20, 22, 15)), 622.5);
  add("21", new Date(Date.UTC(2026, 8, 21, 23, 30)), new Date(Date.UTC(2026, 8, 22, 0, 15)), 435.7);
  add("22", new Date(Date.UTC(2026, 8, 22, 1, 0)), new Date(Date.UTC(2026, 8, 22, 1, 20)), 500);
  return workbook.xlsx.writeBuffer();
}

test("imports completed DH1 power commands into S1/S2 operating events", async () => {
  const result = await parseOperationCommandWorkbook(await sourceWorkbookBytes(), "DanhSachLenhKetThuc.xlsx", "2026-09-19");
  assert.equal(result.operatingDate, "2026-09-19");
  assert.equal(result.events.S1.length, 3);
  assert.equal(result.events.S2.length, 3);
  assert.equal(result.initialPowerMw.S1, 435.7);
  assert.equal(result.initialPowerMw.S2, 435.7);
  assert.deepEqual(result.events.S1.map(event => event.description), [
    "Tăng tải S1 từ 435.7MW lên 540.7MW",
    "Tăng tải S1 từ 540.7MW lên 622.5MW",
    "Giảm tải S1 từ 622.5MW về 517.5MW",
  ]);
  assert.deepEqual(result.events.S2.map(event => event.description), [
    "Tăng tải S2 từ 435.7MW lên 530MW",
    "Tăng tải S2 từ 530MW lên 622.5MW",
    "Giảm tải S2 từ 622.5MW về 517.5MW",
  ]);
  assert.deepEqual(result.allEvents.slice(0, 2).map(event => event.unit), ["S2", "S1"]);
  assert.equal(result.allEvents[0].startAt, "2026-09-19 00:07");
  assert.equal(result.allEvents[0].endAt, "2026-09-19 00:34");
});

test("classifies operation commands by the BCSX event-type regulation", () => {
  assert.equal(classifyOperationCommand("Thay đổi công suất"), 1);
  assert.equal(classifyOperationCommand("Ngừng tổ máy"), 2);
  assert.equal(classifyOperationCommand("Khởi động tổ máy"), 2);
  assert.equal(classifyOperationCommand("Hòa lưới tổ máy"), 2);
  assert.equal(classifyOperationCommand("Tách ra sửa chữa theo kế hoạch"), 3);
  assert.equal(classifyOperationCommand("Đưa tổ máy vào dự phòng"), 3);
  assert.equal(classifyOperationCommand("Bất thường điện áp cao"), 4);
  assert.equal(classifyOperationCommand("Ngừng sự cố do bảo vệ tác động"), 5);
});

test("imports the completed S1 shutdown on 21/09 and ignores stopped power commands", async () => {
  const result = await parseOperationCommandWorkbook(await september21WorkbookBytes(), "DanhSachLenhKetThuc.xlsx", "2026-09-21");
  assert.equal(result.sourceRows, 3);
  assert.equal(result.ignoredRows, 2);
  assert.equal(result.events.S1.length, 1);
  assert.equal(result.events.S2.length, 2);
  assert.equal(result.events.S1[0].eventType, 2);
  assert.equal(result.events.S1[0].description, "Ngừng tổ máy S1 theo lệnh điều độ (giảm tải từ 435.7MW về 0MW)");
  assert.deepEqual(result.events.S2.map(event => event.eventType), [1, 1]);
});

test("keeps below-minimum reduction and recovery as normal type-1 events when there is no shutdown command", async () => {
  const result = await parseOperationCommandWorkbook(await belowMinimumWithoutShutdownBytes(), "DanhSachLenhKetThuc.xlsx", "2026-09-21");
  assert.deepEqual(result.events.S1.map(event => event.eventType), [1, 1]);
  assert.equal(result.events.S1[0].description.includes("225.7MW"), true);
  assert.equal(result.events.S1[1].description.includes("435.7MW"), true);
});

test("classifies a shutdown from minimum load to zero in under three minutes as a type-5 protection trip", async () => {
  const result = await parseOperationCommandWorkbook(await shutdownDurationWorkbookBytes(2), "DanhSachLenhKetThuc.xlsx", "2026-07-07");
  assert.equal(result.events.S2[0].eventType, 5);
  assert.equal(result.events.S2[0].description, "Ngừng sự cố tổ máy S2 do bảo vệ tác động (trip từ 435.7MW về 0MW trong thời gian dưới 3 phút)");
});

test("keeps a shutdown taking exactly three minutes as a type-2 dispatch shutdown", async () => {
  const result = await parseOperationCommandWorkbook(await shutdownDurationWorkbookBytes(3), "DanhSachLenhKetThuc.xlsx", "2026-07-07");
  assert.equal(result.events.S2[0].eventType, 2);
  assert.equal(result.events.S2[0].description, "Ngừng tổ máy S2 theo lệnh điều độ (giảm tải từ 435.7MW về 0MW)");
});

test("keeps a rapid reserve command as type 3 instead of treating it as a protection trip", async () => {
  const result = await parseOperationCommandWorkbook(await shutdownDurationWorkbookBytes(2, "Đưa tổ máy vào dự phòng"), "DanhSachLenhKetThuc.xlsx", "2026-07-07");
  assert.equal(result.events.S2[0].eventType, 3);
});

test("imports only commands starting on the selected date and keeps midnight completion", async () => {
  const result = await parseOperationCommandWorkbook(await multiDateMidnightWorkbookBytes(), "DanhSachLenhKetThuc.xlsx", "2026-09-21");
  assert.equal(result.operatingDate, "2026-09-21");
  assert.equal(result.sourceRows, 1);
  assert.equal(result.ignoredRows, 2);
  assert.equal(result.events.S1.length, 1);
  assert.equal(result.events.S1[0].startAt, "2026-09-21 23:30");
  assert.equal(result.events.S1[0].endAt, "2026-09-22 00:15");
  assert.equal(result.events.S1[0].description, "Giảm tải S1 từ 622.5MW về 435.7MW");
});

test("builds the five-column QLKT upload workbook", async () => {
  const result = await parseOperationCommandWorkbook(await sourceWorkbookBytes(), "DanhSachLenhKetThuc.xlsx", "2026-09-19");
  const bytes = await buildQlktOperationWorkbook(result);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const worksheet = workbook.getWorksheet("DH1 TGVH");
  assert.ok(worksheet);
  assert.deepEqual(worksheet.getRow(1).values.slice(1, 6), ["BĐ", "KT", "Mã SK", "Sự kiện", "TM"]);
  assert.equal(worksheet.getCell("A2").numFmt, "[$-1000000]h:mm;@");
  assert.equal(worksheet.getCell("C2").value, 1);
  assert.equal(worksheet.getCell("D2").value, "Tăng tải S2 từ 435.7MW lên 530MW");
  assert.equal(worksheet.getCell("E2").value, "DH1");
  assert.equal(worksheet.rowCount, 7);
  assert.equal(qlktOperationFileName("2026-09-19"), "DH1_Thoi_gian_VH_19.09.2026.xlsx");
});

test("rejects a source workbook with no commands starting on the selected operating date", async () => {
  const bytes = await sourceWorkbookBytes();
  await assert.rejects(
    () => parseOperationCommandWorkbook(bytes, "DanhSachLenhKetThuc.xlsx", "2026-09-20"),
    /trong ngày 20\/09\/2026/,
  );
});
