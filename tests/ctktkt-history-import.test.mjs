import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildCtktktHistoryImportPackage } from "../lib/ctktkt-history-import.ts";

function workbookBytes(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, values] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet([[""]]);
    for (const [cell, value] of Object.entries(values)) {
      worksheet[cell] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value };
    }
    worksheet["!ref"] = "A1:AV181";
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

test("month import reads all matching day sheets, preserves zero and skips blank sheets and other months",async()=>{
 const bytes=workbookBytes({"d-1":{AB8:100},"01":{W8:120},"Ngày 02":{W8:0},"03":{},"04.08.2026":{W8:999},"30":{W8:150},"31":{W8:300},"Tổng hợp tháng":{W8:800}});
 const result=await buildCtktktHistoryImportPackage("file.xlsx",bytes,undefined,"2026-09");
 assert.deepEqual(result.days.map(day=>day.date),["2026-09-01","2026-09-02","2026-09-30"]);
 assert.equal(result.days[1].manualEntries.find(entry=>entry.cell==="W8").value,"0");
 assert.ok(result.days.every(day=>day.manualEntries.every(entry=>entry.value!==""&&entry.cell!=="C181")));
 assert.equal(result.supportingDays[0].date,"2026-08-31");
 assert.equal(result.supportingDays[0].manualEntries[0].cell,"AB8");
});

test("month import skips formulas and linked cells instead of preparing blank overwrite entries",async()=>{
 const workbook=XLSX.utils.book_new();
 const sheet={W8:{t:"n",v:123,f:"1+122"},W9:{t:"n",v:234},M3:{t:"n",v:456},"!ref":"A1:AV181"};
 XLSX.utils.book_append_sheet(workbook,sheet,"01");
 const result=await buildCtktktHistoryImportPackage("file.xlsx",XLSX.write(workbook,{type:"array",bookType:"xlsx"}),undefined,"2026-09");
 assert.equal(result.days[0].manualEntries.some(entry=>entry.cell==="W8"),false);
 assert.equal(result.days[0].manualEntries.some(entry=>entry.cell==="M3"),false);
 assert.equal(result.days[0].manualEntries.find(entry=>entry.cell==="W9").value,"234");
 assert.ok(result.warnings.some(item=>item.cell==="W8"));
 await assert.rejects(()=>buildCtktktHistoryImportPackage("file.xlsx",new ArrayBuffer(0),undefined,"2026-13"));
});

test("month import includes additional manual fields and converts source event tables to normalized events",async()=>{
 const bytes=workbookBytes({"01":{I35:2,W86:100,B85:"Khởi động tổ máy S1",C88:100,C89:10,E88:140,E89:20,C61:123,E59:"Hòa lưới S1\n01/09/2026 04:30"},"02":{W86:999,I35:0}});
 const result=await buildCtktktHistoryImportPackage("file.xlsx",bytes,undefined,"2026-09");
 assert.equal(result.days[0].manualEntries.find(entry=>entry.cell==="I35").value,"2");
 assert.equal(result.days[1].manualEntries.some(entry=>entry.cell==="W86"),false);
 const events=JSON.parse(result.days[0].manualEntries.find(entry=>entry.cell==="STARTUP_EVENTS_JSON").value);
 assert.equal(events.length,1);
 assert.equal(events[0].unit,"S1");
 assert.equal(events[0].points.start.oilFeed,"100");
 assert.equal(events[0].points.start.power['61'],"123");
 assert.equal(events[0].points.grid_sync.time,"2026-09-01T04:30");
});

test("history import selects only the requested day and recognizes Vietnamese sheet names", async () => {
  const bytes = workbookBytes({
    "Ngày 16": {},
    "Ngày 17": { W8: 123.45 },
    "Ngày 18": { W8: 999 },
  });

  const result = await buildCtktktHistoryImportPackage("file-khong-can-ngay.xlsx", bytes, "2026-09-17");

  assert.equal(result.month, "2026-09");
  assert.equal(result.throughDay, 17);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].date, "2026-09-17");
  assert.equal(result.days[0].sheetName, "Ngày 17");
  assert.equal(result.days[0].manualEntries.find(entry => entry.cell === "W8")?.value, "123.45");
  assert.equal(result.days.some(day => day.sheetName === "Ngày 18"), false);
});

test("history import recognizes a sheet named with the complete selected date", async () => {
  const bytes = workbookBytes({
    "20.09.2026": {},
    "21.09.2026": { W8: 321 },
  });

  const result = await buildCtktktHistoryImportPackage("bao-cao.xlsx", bytes, "2026-09-21");
  assert.equal(result.days[0].sheetName, "21.09.2026");
  assert.equal(result.days[0].manualEntries.find(entry => entry.cell === "W8")?.value, "321");
});

test("history import reports the exact previous sheet required for formula comparison", async () => {
  const bytes = workbookBytes({ "Ngày 17": { W8: 123 } });

  await assert.rejects(
    () => buildCtktktHistoryImportPackage("bao-cao.xlsx", bytes, "2026-09-17"),
    /Thiếu sheet 16 để tính và đối chiếu/,
  );
});

test("history import ignores draft cells that are not part of the day-03 reference", async () => {
  const bytes = workbookBytes({
    "Ngày 02": { W8: 100 },
    "Ngày 03": { W8: 120, G52: "1 thùng nháp" },
  });

  const result = await buildCtktktHistoryImportPackage("chi-tieu.xlsx", bytes, "2026-09-03");
  const importedCells = new Set(result.days[0].manualEntries.map(entry => entry.cell));

  assert.equal(importedCells.has("W8"), true);
  assert.equal(importedCells.has("G52"), false);
  assert.equal(result.days[0].manualEntries.find(entry => entry.cell === "C181")?.value, "1245");
});

test("history import audits Excel production formulas against meter differences, not PMIS", async () => {
  const bytes = workbookBytes({
    "Ngày 04": { AB8: 1000, AB9: 900, AB10: 100, AB11: 50, AL8: 2000, AL9: 1800, AL10: 200, AL11: 100 },
    "Ngày 05": {
      AB8: 1100, AB9: 990, AB10: 106, AB11: 54,
      J157: 120, K157: 100,
      E20: 100, E21: 90, E25: 10, E27: 10,
    },
  });

  const result = await buildCtktktHistoryImportPackage("CHI_TIEU_KTKT_05.09.2026.xlsx", bytes, "2026-09-05");
  const audit = result.audits[0];
  const productionChecks = audit.failed.filter(item => ["E20", "E21", "E25", "E27"].includes(item.sourceCell));
  assert.deepEqual(productionChecks, []);
  assert.deepEqual(result.supportingDays, [{
    date: "2026-09-04",
    sheetName: "Ngày 04",
    manualEntries: [
      { cell: "AB8", value: "1000" },
      { cell: "AB9", value: "900" },
      { cell: "AB10", value: "100" },
      { cell: "AB11", value: "50" },
      { cell: "AL8", value: "2000" },
      { cell: "AL9", value: "1800" },
      { cell: "AL10", value: "200" },
      { cell: "AL11", value: "100" },
    ],
  }]);
  assert.equal(result.totals.supportingValues, 8);
});
