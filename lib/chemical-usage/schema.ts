import type { getRawDb } from "@/db";

let chemicalUsageSchemaEnsured = false;

export async function ensureChemicalUsageSchema(rawDb: ReturnType<typeof getRawDb>) {
  if (chemicalUsageSchemaEnsured) return;

  await rawDb.prepare(`
    CREATE TABLE IF NOT EXISTS chemical_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      usage_date TEXT NOT NULL,
      chemical_code TEXT NOT NULL,
      material_code TEXT NOT NULL,
      chemical_name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'Tấn',
      quantity REAL NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      plant_unit TEXT NOT NULL DEFAULT 'Chung',
      reference TEXT NOT NULL DEFAULT '',
      entered_by_user_id INTEGER NOT NULL,
      entered_by_name TEXT NOT NULL,
      entered_by_position TEXT NOT NULL,
      source_key TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const columns = await rawDb.prepare("PRAGMA table_info(chemical_usage_logs)").all();
  if (!columns.results.some(column => String(column.name || "") === "source_key")) {
    await rawDb.prepare("ALTER TABLE chemical_usage_logs ADD COLUMN source_key TEXT NOT NULL DEFAULT ''").run();
  }
  await rawDb.prepare("CREATE INDEX IF NOT EXISTS idx_chemical_usage_date ON chemical_usage_logs (usage_date)").run();
  await rawDb.prepare("CREATE INDEX IF NOT EXISTS idx_chemical_usage_code_date ON chemical_usage_logs (chemical_code, usage_date)").run();
  await rawDb.prepare("CREATE UNIQUE INDEX IF NOT EXISTS uidx_chemical_usage_source_key ON chemical_usage_logs (source_key) WHERE source_key <> ''").run();
  chemicalUsageSchemaEnsured = true;
}
