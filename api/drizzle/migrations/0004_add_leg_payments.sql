CREATE TABLE `leg_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`leg_id` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`leg_id`) REFERENCES `legs`(`id`) ON UPDATE no action ON DELETE cascade
);
