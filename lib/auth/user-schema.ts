let schemaEnsured = false;

export async function ensureUserSchema(rawDb: ReturnType<typeof import("@/db").getRawDb>) {
  if (schemaEnsured) return;
  try {
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS position_permissions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        position text NOT NULL,
        role text DEFAULT 'viewer' NOT NULL,
        permissions text DEFAULT '[]' NOT NULL,
        description text DEFAULT '' NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).run();
    await rawDb.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_position_permissions_position ON position_permissions (position)`).run();
  } catch {}
  try {
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        username text NOT NULL,
        ip text NOT NULL,
        attempted_at integer NOT NULL
      )
    `).run();
    await rawDb.prepare(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts (username, attempted_at)`).run();
    await rawDb.prepare(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip, attempted_at)`).run();
  } catch {}

  const alterColumns = [
    "ALTER TABLE users ADD COLUMN employee_code text",
    "ALTER TABLE users ADD COLUMN position text",
    "ALTER TABLE users ADD COLUMN department text DEFAULT 'Vận hành 1'",
    "ALTER TABLE users ADD COLUMN email_company text",
    "ALTER TABLE users ADD COLUMN email_work text",
    "ALTER TABLE users ADD COLUMN phone text",
    "ALTER TABLE users ADD COLUMN status text DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN must_change_password integer DEFAULT 0 NOT NULL",
  ];
  for (const sql of alterColumns) {
    try {
      await rawDb.prepare(sql).run();
    } catch {}
  }
  schemaEnsured = true;
}

