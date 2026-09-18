import test from "node:test";
import assert from "node:assert/strict";

const datePattern = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function validateNotePayload(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.entries) || body.entries.length > 500) {
    throw new Error("Danh sách đánh giá lịch sử không hợp lệ.");
  }
  const seen = new Set();
  return body.entries.map(item => {
    if (!item || typeof item !== "object") throw new Error("Một dòng đánh giá không hợp lệ.");
    const operatingDate = String(item.operatingDate || "");
    const noteS1 = String(item.noteS1 || "").trim();
    const noteS2 = String(item.noteS2 || "").trim();
    if (!datePattern.test(operatingDate) || seen.has(operatingDate)) {
      throw new Error("Ngày đánh giá không hợp lệ hoặc bị trùng.");
    }
    if (noteS1.length > 1000 || noteS2.length > 1000) {
      throw new Error(`Đánh giá ngày ${operatingDate} dài quá 1.000 ký tự.`);
    }
    seen.add(operatingDate);
    return { operatingDate, noteS1, noteS2 };
  });
}

test("Validate payload ghi chú: chấp nhận ghi chú S1 và S2 hợp lệ", () => {
  const result = validateNotePayload({
    entries: [
      { operatingDate: "2026-09-01", noteS1: "Tổ S1 chạy ổn định", noteS2: "Tổ S2 quá nhiệt lò" },
      { operatingDate: "2026-09-02", noteS1: "", noteS2: "Bổ sung nhận xét S2" },
    ]
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].operatingDate, "2026-09-01");
  assert.equal(result[0].noteS1, "Tổ S1 chạy ổn định");
  assert.equal(result[0].noteS2, "Tổ S2 quá nhiệt lò");
  assert.equal(result[1].noteS1, "");
  assert.equal(result[1].noteS2, "Bổ sung nhận xét S2");
});

test("Validate payload ghi chú: từ chối ngày sai định dạng", () => {
  assert.throws(() => {
    validateNotePayload({
      entries: [{ operatingDate: "2026/09/01", noteS1: "test" }]
    });
  }, /Ngày đánh giá không hợp lệ/);
});

test("Validate payload ghi chú: từ chối nhận xét quá 1000 ký tự", () => {
  assert.throws(() => {
    validateNotePayload({
      entries: [{ operatingDate: "2026-09-01", noteS1: "a".repeat(1001) }]
    });
  }, /dài quá 1.000 ký tự/);
});

