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
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ppa_heat_rate_daily_date` ON `ppa_heat_rate_daily` (`operating_date`);--> statement-breakpoint
CREATE INDEX `idx_ppa_heat_rate_daily_date` ON `ppa_heat_rate_daily` (`operating_date`);