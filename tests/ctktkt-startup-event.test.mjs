import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { applyCtktktStartupEventMetadata } from "../lib/ctktkt-startup-event.ts";

test("incident oil export shows unit, milestones and meter-based phase consumption", () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("03");
  applyCtktktStartupEventMetadata(sheet, {
    "KTKT:STARTUP_UNIT": "S1",
    "KTKT:STARTUP_EVENT": "incident_oil",
    "KTKT:STARTUP_OIL_START_TIME": "01:15",
    "KTKT:STARTUP_GRID_SYNC_TIME": "04:30",
    "KTKT:STARTUP_MIN_LOAD_TIME": "05:10",
    "KTKT:STARTUP_MIN_LOAD_MW": "180",
    "KTKT:C87": "100", "KTKT:C88": "20",
    "KTKT:E87": "130", "KTKT:E88": "25",
    "KTKT:D87": "150", "KTKT:D88": "27",
  });

  assert.match(String(sheet.getCell("B86").value), /S1 - ĐỐT DẦU DO SỰ CỐ/);
  assert.match(String(sheet.getCell("C86").value), /01:15/);
  assert.match(String(sheet.getCell("D86").value), /04:30/);
  assert.match(String(sheet.getCell("E86").value), /180 MW/);
  assert.equal(sheet.getCell("D87").value, 130);
  assert.equal(sheet.getCell("E87").value, 150);
  assert.equal(sheet.getCell("C89").value, 25);
  assert.equal(sheet.getCell("D89").value, 18);
  assert.equal(sheet.getCell("E89").value, 43);
  assert.match(String(sheet.getCell("B90").value), /tổng: 43 tấn/);
});
