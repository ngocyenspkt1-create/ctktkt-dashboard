import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client/http";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("READ_INDEX_ERROR: missing database configuration.");
  process.exitCode = 1;
} else {
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const sql = readFileSync(new URL("../docs/database/quota-read-index.sql", import.meta.url), "utf8");
    await client.executeMultiple(sql);
    const plan = await client.execute({
      sql: "EXPLAIN QUERY PLAN SELECT operating_date, field_code, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? AND field_code IN (?, ?, ?, ?, ?)",
      args: ["2026-01-01", "2026-11-01", "F", "L", "CS", "CT", "CU"],
    });
    const details = plan.rows.map(row => String(row.detail));
    if (!details.some(detail => detail.includes("idx_daily_inputs_field_date"))) throw new Error("Optimizer did not select the new index.");
    console.log(JSON.stringify({ status: "OK", index: "idx_daily_inputs_field_date", plan: details }));
  } catch (error) {
    // Never print connection details or credentials.
    const message = String(error?.message || "");
    console.error(message.includes("BLOCKED")
      ? "READ_INDEX_BLOCKED: Turso quota prevents optimization; retry after the account is unblocked."
      : "READ_INDEX_ERROR: index application or plan verification failed; no data was changed.");
    process.exitCode = 1;
  } finally {
    client.close();
  }
}
