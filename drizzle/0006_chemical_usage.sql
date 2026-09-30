CREATE TABLE `chemical_usage_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usage_date` text NOT NULL,
	`chemical_code` text NOT NULL,
	`material_code` text NOT NULL,
	`chemical_name` text NOT NULL,
	`unit` text DEFAULT 'Tấn' NOT NULL,
	`quantity` real NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`plant_unit` text DEFAULT 'Chung' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`entered_by_user_id` integer NOT NULL,
	`entered_by_name` text NOT NULL,
	`entered_by_position` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chemical_usage_date` ON `chemical_usage_logs` (`usage_date`);
--> statement-breakpoint
CREATE INDEX `idx_chemical_usage_code_date` ON `chemical_usage_logs` (`chemical_code`,`usage_date`);
