import { createClient, type Client, type InValue, type Row } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import {createHash} from "node:crypto";
import {cachedOperationalRows} from "../lib/operational-query-cache";
import {operationalWriteKeys} from "../lib/operational-query-policy";

let client: Client | null = null;
let versionSchema: Promise<unknown> | null = null;
let versionRead: Promise<Record<string, number>> | null = null;

function ensureVersionSchema() {
  if (!versionSchema) {
    versionSchema = getClient().execute("CREATE TABLE IF NOT EXISTS operational_read_versions (cache_key TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0)")
      .catch(error => { versionSchema = null; throw error; });
  }
  return versionSchema;
}

async function loadReadVersions() {
  if (versionRead) return versionRead;
  const current = (async () => {
    await ensureVersionSchema();
    const result = await getClient().execute("SELECT cache_key, version FROM operational_read_versions");
    return Object.fromEntries(result.rows.map(row => [String(row.cache_key), Number(row.version)]));
  })();
  versionRead = current;
  try { return await current; }
  finally { if (versionRead === current) versionRead = null; }
}

function versionStatements(keys: string[]) {
  return [...new Set(keys)].map(key => ({
    sql: "INSERT INTO operational_read_versions (cache_key, version) VALUES (?, 1) ON CONFLICT(cache_key) DO UPDATE SET version = version + 1",
    args: [key] as InValue[],
  }));
}

async function execute(sql: string, args: InValue[]) {
  const keys = operationalWriteKeys(sql, args);
  if (!keys.length) return getClient().execute({sql, args});
  await ensureVersionSchema();
  // Data and revisions commit together. A failed write cannot publish a new
  // revision; a successful write cannot leave another instance on old data.
  const results = await getClient().batch([{sql, args}, ...versionStatements(keys)], 'write');
  versionRead = null;
  return results[0];
}

async function readRows(sql: string, args: InValue[]): Promise<ReturnType<typeof rowsToObjects>> {
  const namespace = createHash('sha256').update(process.env.TURSO_DATABASE_URL || '').digest('hex');
  return await cachedOperationalRows(sql, args, namespace, loadReadVersions, async () => {
    const result = await execute(sql, args);
    return rowsToObjects(result.columns, result.rows);
  }) as ReturnType<typeof rowsToObjects>;
}

/** A tiny fresh metadata read, never cached. Used for conditional mirror GET. */
export function getOperationalReadVersions() { return loadReadVersions(); }

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
      return { results: await readRows(sql, inArgs) };
    },
    first: async () => {
      const rows = await readRows(sql, inArgs);
      return rows[0] || null;
    },
    run: async () => {
      const result = await execute(sql, inArgs);
      return { success: true, meta: toMeta(result) };
    },
  };
}

export function getRawDb() {
  return {
    prepare: (sql: string) => ({ ...statement(sql), bind: (...args: unknown[]) => statement(sql, args) }),
    batch: async (statements: Array<{ sql: string; args: InValue[] }>) => {
      const keys = statements.flatMap(item => operationalWriteKeys(item.sql, item.args));
      if (keys.length) await ensureVersionSchema();
      const originals = statements.map(item => ({ sql: item.sql, args: item.args }));
      const results = keys.length
        ? await getClient().batch([...originals, ...versionStatements(keys)], 'write')
        : await getClient().batch(originals);
      if (keys.length) versionRead = null;
      return results.slice(0, statements.length).map(result => ({ success: true, meta: toMeta(result) }));
    },
  };
}

export function getDb() { return drizzle(getClient(), { schema }); }
