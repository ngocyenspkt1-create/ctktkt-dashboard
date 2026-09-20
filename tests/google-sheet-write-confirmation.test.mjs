import assert from "node:assert/strict";
import test from "node:test";
import { confirmsGoogleSheetWrite } from "../lib/google-sheet-sync.ts";

test("chỉ xác nhận khi Apps Script báo ok đúng hàng cần ghi", () => {
  assert.equal(confirmsGoogleSheetWrite([{ status: "ok", row: 51 }], 51), true);
  assert.equal(confirmsGoogleSheetWrite([{ status: "ok", row: 50 }], 51), false);
  assert.equal(confirmsGoogleSheetWrite([{ status: "error", row: 51 }], 51), false);
  assert.equal(confirmsGoogleSheetWrite({ status: "ok", row: 51 }, 51), false);
});
