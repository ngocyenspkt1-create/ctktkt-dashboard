import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  employeeCode: text("employee_code"),
  position: text("position"),
  department: text("department").notNull().default("Vận hành 1"),
  emailCompany: text("email_company"),
  emailWork: text("email_work"),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("uidx_users_username").on(table.username), index("idx_users_position").on(table.position)]);

export const positionPermissions = sqliteTable("position_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  position: text("position").notNull(),
  role: text("role").notNull().default("viewer"),
  permissions: text("permissions").notNull().default("[]"),
  description: text("description").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("uidx_position_permissions_position").on(table.position)]);

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

export const shiftReadings = sqliteTable("shift_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operatingDate: text("operating_date").notNull(),
  unit: text("unit").notNull(),
  timeSlot: text("time_slot").notNull(),
  metric: text("metric").notNull(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("uidx_shift_readings").on(table.operatingDate, table.unit, table.timeSlot, table.metric), index("idx_shift_readings_date").on(table.operatingDate)]);

export const operatingEvents = sqliteTable("operating_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operatingDate: text("operating_date").notNull(),
  unit: text("unit").notNull(),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull().default(""),
  eventType: integer("event_type").notNull(),
  description: text("description").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("idx_operating_events_date").on(table.operatingDate, table.unit)]);

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
