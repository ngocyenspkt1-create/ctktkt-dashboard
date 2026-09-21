import { existsSync } from "node:fs";
import { createClient } from "@libsql/client/http";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("STORAGE_HEALTH_ERROR: thiếu TURSO_DATABASE_URL trong môi trường hiện tại.");
  process.exitCode = 1;
} else {
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const [pageCountResult, pageSizeResult, freePagesResult, tablesResult] = await Promise.all([
      client.execute("PRAGMA page_count"),
      client.execute("PRAGMA page_size"),
      client.execute("PRAGMA freelist_count"),
      client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
    ]);

    const pageCount = Number(pageCountResult.rows[0]?.[0] || 0);
    const pageSize = Number(pageSizeResult.rows[0]?.[0] || 0);
    const freePages = Number(freePagesResult.rows[0]?.[0] || 0);
    const allocatedBytes = pageCount * pageSize;
    const usedBytes = Math.max(0, pageCount - freePages) * pageSize;
    let totalRows = 0;
    const rowCounts = [];

    for (const row of tablesResult.rows) {
      const table = String(row[0]);
      const quoted = table.replaceAll('"', '""');
      const countResult = await client.execute(`SELECT COUNT(*) FROM "${quoted}"`);
      const count = Number(countResult.rows[0]?.[0] || 0);
      totalRows += count;
      rowCounts.push({ table, count });
    }

    const freePlanBytes = 5 * 1024 * 1024 * 1024;
    const percentage = freePlanBytes > 0 ? (allocatedBytes / freePlanBytes) * 100 : 0;
    const level = percentage >= 95 ? "CRITICAL" : percentage >= 85 ? "WARNING" : percentage >= 70 ? "NOTICE" : "OK";
    const mib = value => Number((value / 1024 / 1024).toFixed(2));

    console.log(JSON.stringify({
      status: level,
      turso: {
        allocatedMiB: mib(allocatedBytes),
        estimatedUsedMiB: mib(usedBytes),
        freePagesMiB: mib(freePages * pageSize),
        freePlanLimitMiB: 5120,
        allocatedPercentOfFreePlan: Number(percentage.toFixed(4)),
        tableCount: rowCounts.length,
        totalRows,
        largestTables: rowCounts.sort((a, b) => b.count - a.count).slice(0, 8),
      },
      note: "Dung lượng Vercel và số lượt đọc/ghi Turso phải kiểm tra riêng trong dashboard nhà cung cấp.",
    }, null, 2));
  } catch (error) {
    console.error(`STORAGE_HEALTH_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}
