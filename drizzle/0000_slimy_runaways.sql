CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fragrance_id` text NOT NULL,
	`author` text NOT NULL,
	`rating` integer NOT NULL,
	`experience` text NOT NULL,
	`disclosure` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consent` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_user_created` ON `reviews` (`user_id`,`created_at`);
