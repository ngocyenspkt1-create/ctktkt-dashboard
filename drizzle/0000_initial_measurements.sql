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
--> statement-breakpoint
CREATE INDEX `idx_measurements_metric_period` ON `measurements` (`metric_code`,`period`);
