ALTER TABLE `reviews` ADD `moderated_by` text;
--> statement-breakpoint
ALTER TABLE `reviews` ADD `moderated_at` text;
--> statement-breakpoint
ALTER TABLE `reviews` ADD `moderation_note` text;
--> statement-breakpoint
CREATE INDEX `idx_reviews_status_created` ON `reviews` (`status`,`created_at`);
