-- Script cập nhật cho CSDL Turso đang chạy
-- Chạy các lệnh này trên Turso SQL Console (dashboard.turso.tech) nếu database đã được tạo trước đó:

ALTER TABLE `users` ADD COLUMN `employee_code` text;
ALTER TABLE `users` ADD COLUMN `position` text;
ALTER TABLE `users` ADD COLUMN `department` text DEFAULT 'Vận hành 1' NOT NULL;
ALTER TABLE `users` ADD COLUMN `email_company` text;
ALTER TABLE `users` ADD COLUMN `email_work` text;
ALTER TABLE `users` ADD COLUMN `phone` text;
ALTER TABLE `users` ADD COLUMN `status` text DEFAULT 'active' NOT NULL;
CREATE INDEX IF NOT EXISTS `idx_users_position` ON `users` (`position`);

CREATE TABLE IF NOT EXISTS `position_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `uidx_position_permissions_position` ON `position_permissions` (`position`);

