ALTER TABLE `users` ADD COLUMN `employee_code` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `position` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `department` text DEFAULT 'Vận hành 1' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_company` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_work` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `phone` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_position` ON `users` (`position`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `position_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uidx_position_permissions_position` ON `position_permissions` (`position`);

