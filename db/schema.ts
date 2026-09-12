import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const measurements = sqliteTable("measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metricCode: text("metric_code").notNull(),
  metricName: text("metric_name").notNull(),
  period: text("period").notNull(),
  actual: text("actual").notNull(),
  limitValue: text("limit_value").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
