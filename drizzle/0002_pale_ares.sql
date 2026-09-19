CREATE INDEX IF NOT EXISTS `idx_api_usage_created_at` ON `api_usage_events` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_api_usage_provider_created_at` ON `api_usage_events` (`provider`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_assessments_created_at` ON `assessments` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_assessments_postcode` ON `assessments` (`postcode`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_leads_assessment_id` ON `leads` (`assessment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_comparisons_assessment_id` ON `pylon_comparisons` (`assessment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_comparisons_assessment_url` ON `pylon_comparisons` (`assessment_id`,`proposal_url`);
