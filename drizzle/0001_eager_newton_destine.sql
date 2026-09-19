CREATE TABLE `api_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`status_code` integer NOT NULL,
	`success` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
