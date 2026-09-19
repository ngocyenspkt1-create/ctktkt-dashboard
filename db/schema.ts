import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const waterShiftLeaders = sqliteTable("water_shift_leaders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("uidx_water_shift_leaders_name").on(table.name)]);

export const waterShiftLogs = sqliteTable("water_shift_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  logDate: text("log_date").notNull(),
  shiftTime: text("shift_time").notNull(),
  shiftTeam: text("shift_team").notNull().default(""),
  shiftLeader: text("shift_leader").notNull().default(""),
  elecRecS1: real("elec_rec_s1").default(0),
  elecRecS2: real("elec_rec_s2").default(0),
  elecGenS1: real("elec_gen_s1").default(0),
  elecGenS2: real("elec_gen_s2").default(0),
  waterRecS1: real("water_rec_s1").default(0),
  waterRecS2: real("water_rec_s2").default(0),
  waterUsedS1: real("water_used_s1").default(0),
  waterUsedS2: real("water_used_s2").default(0),
  waterRatioS1: real("water_ratio_s1").default(0),
  waterRatioS2: real("water_ratio_s2").default(0),
  condenserRecS1: real("condenser_rec_s1").default(0),
  condenserRecS2: real("condenser_rec_s2").default(0),
  condenserUsedS1: real("condenser_used_s1").default(0),
  condenserUsedS2: real("condenser_used_s2").default(0),
  resinWaterS1_24h: real("resin_water_s1_24h").default(0),
  resinWaterS2_24h: real("resin_water_s2_24h").default(0),
  note: text("note").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  uniqueIndex("uidx_water_shift_date_time").on(table.logDate, table.shiftTime),
  index("idx_water_shift_date").on(table.logDate),
]);

