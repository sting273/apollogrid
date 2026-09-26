CREATE TABLE `road_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `road_invitations` (
	`hash` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`role` integer NOT NULL,
	`store` text DEFAULT '' NOT NULL,
	`target` text,
	`expires` integer NOT NULL,
	`used_by` text,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_road_invitations_issuer` ON `road_invitations` (`issuer`);--> statement-breakpoint
CREATE TABLE `road_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`role` integer DEFAULT 3 NOT NULL,
	`leader_id` text,
	`store` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_road_members_name_key` ON `road_members` (`name_key`);--> statement-breakpoint
CREATE INDEX `idx_road_members_leader` ON `road_members` (`leader_id`);--> statement-breakpoint
CREATE TABLE `road_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires` integer NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_road_sessions_member` ON `road_sessions` (`member_id`);--> statement-breakpoint
CREATE TABLE `road_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
