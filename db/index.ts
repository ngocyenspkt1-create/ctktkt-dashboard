import { createClient, type Client, type InValue, type Row } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | null = null;

// Vercel không có Cloudflare D1 — dùng Turso (libSQL) làm database thay thế.
// Turso cũng là SQLite (giống hệt D1 về cú pháp SQL) nên toàn bộ schema và
// câu lệnh SQL thô trong app/api/**/route.ts giữ nguyên không đổi, chỉ cần
// đổi phần kết nối này. Dùng thẳng "@libsql/client/http" (giao thức Hrana qua
// HTTPS thuần, không cần WebSocket) thay vì gói gốc "@libsql/client" — gói
// gốc tự chọn giữa vài bản build (Node/WebSocket, web, workerd...) tuỳ
// "exports condition" lúc bundler đóng gói route, còn bản "/http" chỉ có
// đúng một cách build nên chạy giống hệt nhau ở mọi môi trường, không phụ
// thuộc suy đoán điều kiện của bundler.
function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Thiếu biến môi trường TURSO_DATABASE_URL. Hãy tạo database Turso rồi khai báo TURSO_DATABASE_URL (và TURSO_AUTH_TOKEN nếu không phải file local) trong Vercel Project Settings > Environment Variables."
    );
  }
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

function rowsToObjects(columns: string[], rows: Row[]) {
  return rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

function toMeta(result: { lastInsertRowid?: bigint; rowsAffected: number }) {
  return { last_row_id: Number(result.lastInsertRowid ?? 0), changes: result.rowsAffected };
}

// Lớp bọc mỏng tương thích với API `.prepare(sql).bind(...args).all()/.first()/.run()`
// và `.batch([...])` của Cloudflare D1 mà toàn bộ route handler trong app/api
// đang gọi trực tiếp — giữ nguyên cách gọi cũ để không phải sửa lại từng route
// khi đổi sang Turso.
function statement(sql: string, args: unknown[] = []) {
  const inArgs = args as InValue[];
  return {
    sql, args: inArgs,
    all: async () => {
      const result = await getClient().execute({ sql, args: inArgs });
      return { results: rowsToObjects(result.columns, result.rows) };
    },
    first: async () => {
      const result = await getClient().execute({ sql, args: inArgs });
      return result.rows.length ? rowsToObjects(result.columns, result.rows)[0] : null;
    },
    run: async () => {
      const result = await getClient().execute({ sql, args: inArgs });
      return { success: true, meta: toMeta(result) };
    },
  };
}

export function getRawDb() {
  return {
    prepare: (sql: string) => ({ ...statement(sql), bind: (...args: unknown[]) => statement(sql, args) }),
    batch: async (statements: Array<{ sql: string; args: InValue[] }>) => {
      const results = await getClient().batch(statements.map(item => ({ sql: item.sql, args: item.args })));
      return results.map(result => ({ success: true, meta: toMeta(result) }));
    },
  };
}

export function getDb() { return drizzle(getClient(), { schema }); }
