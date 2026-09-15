import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const measurements = sqliteTable("measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metricCode: text("metric_code").notNull(),
  metricName: text("metric_name").notNull(),
  period: text("period").notNull(),
  actual: text("actual").notNull(),
  limitValue: text("limit_value").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("idx_measurements_metric_period").on(table.metricCode, table.period)]);

export const dailyInputs = sqliteTable("daily_inputs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operatingDate: text("operating_date").notNull(),
  fieldCode: text("field_code").notNull(),
  value: text("value").notNull(),
  note: text("note").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("uidx_daily_inputs_date_field").on(table.operatingDate, table.fieldCode), index("idx_daily_inputs_date").on(table.operatingDate)]);

export const ppaHeatRateDaily = sqliteTable("ppa_heat_rate_daily", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operatingDate: text("operating_date").notNull(),
  sourceData: text("source_data").notNull(),
  sourceFiles: text("source_files").notNull().default("[]"),
  grossS1Kwh: text("gross_s1_kwh").notNull(),
  netS1Kwh: text("net_s1_kwh").notNull(),
  grossS2Kwh: text("gross_s2_kwh").notNull(),
  netS2Kwh: text("net_s2_kwh").notNull(),
  ppaPlant: text("ppa_plant").notNull(),
  ppaS1: text("ppa_s1").notNull(),
  ppaS2: text("ppa_s2").notNull(),
  noteS1: text("note_s1").notNull().default(""),
  noteS2: text("note_s2").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("uidx_ppa_heat_rate_daily_date").on(table.operatingDate), index("idx_ppa_heat_rate_daily_date").on(table.operatingDate)]);
