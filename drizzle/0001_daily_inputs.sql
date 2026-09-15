CREATE TABLE `daily_inputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operating_date` text NOT NULL,
	`field_code` text NOT NULL,
	`value` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_daily_inputs_date_field` ON `daily_inputs` (`operating_date`,`field_code`);
--> statement-breakpoint
CREATE INDEX `idx_daily_inputs_date` ON `daily_inputs` (`operating_date`);
