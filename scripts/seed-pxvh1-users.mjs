import { createClient } from "@libsql/client/http";
import { DEFAULT_POSITIONS, INITIAL_USERS } from "../lib/auth/initial-users-data.js";
import { hashPassword } from "../lib/auth/password.js";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Vui lòng đặt TURSO_DATABASE_URL (và TURSO_AUTH_TOKEN nếu cần) trước khi chạy script.");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  console.log("Đang khởi tạo cấu trúc bảng...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS position_permissions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      position text NOT NULL,
      role text DEFAULT 'viewer' NOT NULL,
      permissions text DEFAULT '[]' NOT NULL,
      description text DEFAULT '' NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_position_permissions_position ON position_permissions (position)`);

  // Bổ sung các cột vào bảng users nếu chưa có
  const alterStatements = [
    "ALTER TABLE users ADD COLUMN employee_code text",
    "ALTER TABLE users ADD COLUMN position text",
    "ALTER TABLE users ADD COLUMN department text DEFAULT 'Vận hành 1' NOT NULL",
    "ALTER TABLE users ADD COLUMN email_company text",
    "ALTER TABLE users ADD COLUMN email_work text",
    "ALTER TABLE users ADD COLUMN phone text",
    "ALTER TABLE users ADD COLUMN status text DEFAULT 'active' NOT NULL",
    "ALTER TABLE users ADD COLUMN must_change_password integer DEFAULT 0 NOT NULL",
  ];

  for (const sql of alterStatements) {
    try {
      await client.execute(sql);
    } catch {
      // Đã tồn tại cột
    }
  }

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_position ON users (position)`);
  } catch {}

  console.log(`Đang nạp ${DEFAULT_POSITIONS.length} cương vị...`);
  for (const pos of DEFAULT_POSITIONS) {
    await client.execute({
      sql: `INSERT INTO position_permissions (position, role, permissions, description)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(position) DO UPDATE SET
              role = excluded.role,
              description = excluded.description`,
      args: [pos.position, pos.role, JSON.stringify(pos.permissions), pos.description],
    });
  }

  const initialPassword = process.env.INITIAL_USER_PASSWORD || '';
  if (initialPassword.length < 8) throw new Error('Đặt biến môi trường INITIAL_USER_PASSWORD (>= 8 ký tự) làm mật khẩu tạm; người dùng phải đổi ở lần đăng nhập đầu.');
  console.log(`Đang nạp ${INITIAL_USERS.length} tài khoản nhân sự...`);
  let count = 0;
  for (const u of INITIAL_USERS) {
    const cleanUsername = u.username.trim().toLowerCase();

    await client.execute({
      sql: `INSERT INTO users (
              username, password_hash, display_name, role, employee_code, position, department, email_company, email_work, phone, status, must_change_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(username) DO UPDATE SET
              employee_code = excluded.employee_code,
              position = excluded.position,
              department = excluded.department,
              email_company = excluded.email_company,
              email_work = excluded.email_work,
              role = excluded.role,
              status = excluded.status`,
      args: [
        cleanUsername,
        hashPassword(initialPassword),
        u.displayName,
        u.role,
        u.employeeCode,
        u.position,
        u.department,
        u.emailCompany,
        u.emailWork,
        u.phone,
        u.status,
      ],
    });
    count++;
  }

  console.log(`Hoàn thành! Đã nạp/đồng bộ ${count} tài khoản và ${DEFAULT_POSITIONS.length} cương vị.`);
}

main().catch(err => {
  console.error("Lỗi:", err);
  process.exit(1);
});

