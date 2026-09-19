CREATE TABLE `admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`postcode` text NOT NULL,
	`address` text NOT NULL,
	`annual_usage_kwh` integer NOT NULL,
	`usage_source` text NOT NULL,
	`panel_count` integer NOT NULL,
	`panel_watts` integer NOT NULL,
	`system_kwp` real NOT NULL,
	`annual_generation_kwh` integer NOT NULL,
	`annual_bill_before` real NOT NULL,
	`annual_bill_solar_only` real NOT NULL,
	`annual_bill_solar_battery` real NOT NULL,
	`annual_benefit` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`preferred_time` text DEFAULT '' NOT NULL,
	`consent` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pylon_comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`proposal_url` text DEFAULT '' NOT NULL,
	`pylon_annual_usage_kwh` integer NOT NULL,
	`pylon_panel_count` integer NOT NULL,
	`pylon_generation_kwh` integer NOT NULL,
	`pylon_bill_before` real NOT NULL,
	`pylon_bill_after` real NOT NULL,
	`input_hit_rate` real NOT NULL,
	`generation_hit_rate` real NOT NULL,
	`benefit_hit_rate` real NOT NULL,
	`overall_hit_rate` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action
);
