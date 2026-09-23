import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { PPA_HEAT_RATE_UPSERT_SQL } from "../lib/ppa-heat-rate-persistence.ts";

const values = (noteS1, noteS2, ppaPlant = "10400") => [
  "2026-09-21", "{}", "[]",
  "1", "2", "3", "4",
  ppaPlant, "10410", "10390",
  noteS1, noteS2,
];

async function createDatabase() {
  const db = createClient({ url: "file::memory:" });
  await db.execute(`
    CREATE TABLE ppa_heat_rate_daily (
      operating_date TEXT PRIMARY KEY,
      source_data TEXT NOT NULL,
      source_files TEXT NOT NULL,
      gross_s1_kwh TEXT NOT NULL,
      net_s1_kwh TEXT NOT NULL,
      gross_s2_kwh TEXT NOT NULL,
      net_s2_kwh TEXT NOT NULL,
      ppa_plant TEXT NOT NULL,
      ppa_s1 TEXT NOT NULL,
      ppa_s2 TEXT NOT NULL,
      note_s1 TEXT NOT NULL DEFAULT '',
      note_s2 TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )
  `);
  return db;
}

test("re-importing PPA with blank notes preserves saved notes", async () => {
  const db = await createDatabase();
  try {
    await db.execute({ sql: PPA_HEAT_RATE_UPSERT_SQL, args: values("Old S1 note", "Old S2 note") });
    await db.execute({ sql: PPA_HEAT_RATE_UPSERT_SQL, args: values("", "", "10500") });

    const row = (await db.execute("SELECT ppa_plant, note_s1, note_s2 FROM ppa_heat_rate_daily")).rows[0];
    assert.equal(row.ppa_plant, "10500");
    assert.equal(row.note_s1, "Old S1 note");
    assert.equal(row.note_s2, "Old S2 note");
  } finally {
    db.close();
  }
});

test("saving PPA with nonblank notes still updates saved notes", async () => {
  const db = await createDatabase();
  try {
    await db.execute({ sql: PPA_HEAT_RATE_UPSERT_SQL, args: values("Old S1 note", "Old S2 note") });
    await db.execute({ sql: PPA_HEAT_RATE_UPSERT_SQL, args: values("New S1 note", "New S2 note") });

    const row = (await db.execute("SELECT note_s1, note_s2 FROM ppa_heat_rate_daily")).rows[0];
    assert.equal(row.note_s1, "New S1 note");
    assert.equal(row.note_s2, "New S2 note");
  } finally {
    db.close();
  }
});
