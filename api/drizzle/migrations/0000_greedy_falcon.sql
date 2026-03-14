CREATE TABLE `accommodations` (
	`id` text PRIMARY KEY NOT NULL,
	`leg_id` text NOT NULL,
	`name` text,
	`address` text,
	`cost_per_night` real,
	`total_cost` real,
	`check_in_time` text,
	`check_out_time` text,
	`amenities` text DEFAULT '[]' NOT NULL,
	`booking_link` text,
	`notes` text,
	FOREIGN KEY (`leg_id`) REFERENCES `legs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accommodations_leg_id_unique` ON `accommodations` (`leg_id`);--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`leg_id` text NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`time` text,
	`booking_id` text,
	`booking_link` text,
	`notes` text,
	FOREIGN KEY (`leg_id`) REFERENCES `legs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `car_rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`leg_id` text NOT NULL,
	`company` text,
	`cost` real,
	`pickup_date` text,
	`return_date` text,
	`notes` text,
	FOREIGN KEY (`leg_id`) REFERENCES `legs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `day_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`leg_id` text NOT NULL,
	`date` text NOT NULL,
	`destination_name` text NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`transport_type` text,
	`cost` real,
	`notes` text,
	FOREIGN KEY (`leg_id`) REFERENCES `legs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `legs` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`type` text NOT NULL,
	`order` integer NOT NULL,
	`name` text,
	`start_date` text,
	`end_date` text,
	`nights` integer,
	`transport_type` text,
	`cost` real,
	`duration` text,
	`stops` integer,
	`company` text,
	`booking_id` text,
	`booking_link` text,
	`departure_time` text,
	`arrival_time` text,
	`departure_location` text,
	`arrival_location` text,
	`notes` text,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trip_offsets` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trip_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'planning' NOT NULL,
	`owner_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`google_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);