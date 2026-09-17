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
--> statement-breakpoint
CREATE INDEX `idx_operating_events_date` ON `operating_events` (`operating_date`,`unit`);--> statement-breakpoint
CREATE TABLE `shift_readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operating_date` text NOT NULL,
	`unit` text NOT NULL,
	`time_slot` text NOT NULL,
	`metric` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_shift_readings` ON `shift_readings` (`operating_date`,`unit`,`time_slot`,`metric`);--> statement-breakpoint
CREATE INDEX `idx_shift_readings_date` ON `shift_readings` (`operating_date`);