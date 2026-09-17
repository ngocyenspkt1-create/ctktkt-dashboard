-- Gộp 5 file migration (0000-0004) thành một script duy nhất, đã bỏ các dòng
-- "--> statement-breakpoint" (chỉ là dấu mốc riêng của drizzle-kit, không phải
-- SQL hợp lệ) — để dán một lần vào SQL Shell trên dashboard Turso khi khởi tạo
-- database mới thay thế Cloudflare D1.
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `uidx_users_username` ON `users` (`username`);

CREATE TABLE `measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric_code` text NOT NULL,
	`metric_name` text NOT NULL,
	`period` text NOT NULL,
	`actual` text NOT NULL,
	`limit_value` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_measurements_metric_period` ON `measurements` (`metric_code`,`period`);

CREATE TABLE `daily_inputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operating_date` text NOT NULL,
	`field_code` text NOT NULL,
	`value` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `uidx_daily_inputs_date_field` ON `daily_inputs` (`operating_date`,`field_code`);
CREATE INDEX `idx_daily_inputs_date` ON `daily_inputs` (`operating_date`);

CREATE TABLE `ppa_heat_rate_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operating_date` text NOT NULL,
	`source_data` text NOT NULL,
	`source_files` text DEFAULT '[]' NOT NULL,
	`gross_s1_kwh` text NOT NULL,
	`net_s1_kwh` text NOT NULL,
	`gross_s2_kwh` text NOT NULL,
	`net_s2_kwh` text NOT NULL,
	`ppa_plant` text NOT NULL,
	`ppa_s1` text NOT NULL,
	`ppa_s2` text NOT NULL,
	`note_s1` text DEFAULT '' NOT NULL,
	`note_s2` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `uidx_ppa_heat_rate_daily_date` ON `ppa_heat_rate_daily` (`operating_date`);
CREATE INDEX `idx_ppa_heat_rate_daily_date` ON `ppa_heat_rate_daily` (`operating_date`);

CREATE TABLE `operating_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operating_date` text NOT NULL,
	`unit` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text DEFAULT '' NOT NULL,
	`event_type` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_operating_events_date` ON `operating_events` (`operating_date`,`unit`);

CREATE TABLE `shift_readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operating_date` text NOT NULL,
	`unit` text NOT NULL,
	`time_slot` text NOT NULL,
	`metric` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `uidx_shift_readings` ON `shift_readings` (`operating_date`,`unit`,`time_slot`,`metric`);
CREATE INDEX `idx_shift_readings_date` ON `shift_readings` (`operating_date`);
