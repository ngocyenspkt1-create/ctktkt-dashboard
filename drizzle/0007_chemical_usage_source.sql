ALTER TABLE `chemical_usage_logs` ADD `source_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_chemical_usage_source_key` ON `chemical_usage_logs` (`source_key`) WHERE `source_key` <> '';
