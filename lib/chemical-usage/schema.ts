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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await rawDb.prepare("CREATE INDEX IF NOT EXISTS idx_chemical_usage_date ON chemical_usage_logs (usage_date)").run();
  await rawDb.prepare("CREATE INDEX IF NOT EXISTS idx_chemical_usage_code_date ON chemical_usage_logs (chemical_code, usage_date)").run();
  chemicalUsageSchemaEnsured = true;
}
