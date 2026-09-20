import assert from "node:assert/strict";
import { test } from "node:test";
import { addDaysIso, defaultOperatingDate, vietnamDateIso } from "../lib/operating-date.ts";

test("ngày vận hành mặc định là D-1 theo múi giờ Việt Nam", () => {
  const instant = new Date("2026-09-21T00:30:00Z"); // 07:30 ngày 21/09 tại Việt Nam
  assert.equal(vietnamDateIso(instant), "2026-09-21");
  assert.equal(defaultOperatingDate(instant), "2026-09-20");
});

test("D-1 xử lý đúng khi lùi qua tháng và năm", () => {
  assert.equal(addDaysIso("2026-03-01", -1), "2026-02-28");
  assert.equal(addDaysIso("2026-01-01", -1), "2025-12-31");
});
