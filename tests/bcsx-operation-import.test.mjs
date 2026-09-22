import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildQlktOperationWorkbook, parseOperationCommandWorkbook, qlktOperationFileName } from "../lib/bcsx-operation-import.ts";

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

test("rejects a source workbook that does not match the selected operating date", async () => {
  const bytes = await sourceWorkbookBytes();
  await assert.rejects(
    () => parseOperationCommandWorkbook(bytes, "DanhSachLenhKetThuc.xlsx", "2026-09-20"),
    /không phải ngày đang chọn/,
  );
});
