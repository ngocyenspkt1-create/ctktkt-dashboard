import type { getRawDb } from "@/db";

export const DEFAULT_SHIFT_LEADERS = ["Việt", "Lễ", "Trọng", "Ni", "Châu", "Đàm"];
export const SHIFT_TEAMS = ["A", "B", "C", "D", "E", "F"] as const;
export const SHIFT_TIMES = ["06h00", "14h00", "22h00"] as const;

let waterSchemaEnsured = false;

export async function ensureWaterSchema(rawDb: ReturnType<typeof getRawDb>) {
  if (waterSchemaEnsured) return;

  try {
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS water_shift_leaders (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).run();

    await rawDb.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_water_shift_leaders_name ON water_shift_leaders (name)
    `).run();

    // Kiểm tra xem đã có Trưởng ca nào chưa, nếu chưa thì nạp 6 Trưởng ca mặc định
    const countRes = await rawDb.prepare("SELECT count(*) as count FROM water_shift_leaders").first() as { count?: number } | null;
    if (!countRes || Number(countRes.count ?? 0) === 0) {
      for (let i = 0; i < DEFAULT_SHIFT_LEADERS.length; i++) {
        const name = DEFAULT_SHIFT_LEADERS[i];
        try {
          await rawDb.prepare(
            "INSERT OR IGNORE INTO water_shift_leaders (name, is_active, display_order) VALUES (?, 1, ?)"
          ).bind(name, i + 1).run();
        } catch {}
      }
    }
  } catch (err) {
    console.error("Lỗi khởi tạo bảng water_shift_leaders:", err);
  }

  try {
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS water_shift_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        log_date TEXT NOT NULL,
        shift_time TEXT NOT NULL,
        shift_team TEXT NOT NULL DEFAULT '',
        shift_leader TEXT NOT NULL DEFAULT '',
        elec_rec_s1 REAL DEFAULT 0,
        elec_rec_s2 REAL DEFAULT 0,
        elec_gen_s1 REAL DEFAULT 0,
        elec_gen_s2 REAL DEFAULT 0,
        water_rec_s1 REAL DEFAULT 0,
        water_rec_s2 REAL DEFAULT 0,
        water_used_s1 REAL DEFAULT 0,
        water_used_s2 REAL DEFAULT 0,
        water_ratio_s1 REAL DEFAULT 0,
        water_ratio_s2 REAL DEFAULT 0,
        condenser_rec_s1 REAL DEFAULT 0,
        condenser_rec_s2 REAL DEFAULT 0,
        condenser_used_s1 REAL DEFAULT 0,
        condenser_used_s2 REAL DEFAULT 0,
        resin_water_s1_24h REAL DEFAULT 0,
        resin_water_s2_24h REAL DEFAULT 0,
        note TEXT DEFAULT '',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).run();

    await rawDb.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_water_shift_date_time ON water_shift_logs (log_date, shift_time)
    `).run();

    await rawDb.prepare(`
      CREATE INDEX IF NOT EXISTS idx_water_shift_date ON water_shift_logs (log_date)
    `).run();
  } catch (err) {
    console.error("Lỗi khởi tạo bảng water_shift_logs:", err);
  }

  waterSchemaEnsured = true;
}

