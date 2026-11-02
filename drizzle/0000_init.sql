CREATE TABLE `daily_counters` (
	`date` text PRIMARY KEY NOT NULL,
	`likes_story` integer DEFAULT 0 NOT NULL,
	`likes_post` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text,
	`at` integer NOT NULL,
	`type` text NOT NULL,
	`payload_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_users` (
	`session_id` text NOT NULL,
	`username` text NOT NULL,
	`first_seen_window` integer NOT NULL,
	`discovered_at` integer NOT NULL,
	`state` text NOT NULL,
	`privacy` text DEFAULT 'unknown' NOT NULL,
	`story_result` text,
	`posts_result_json` text,
	`processed_at` integer,
	PRIMARY KEY(`session_id`, `username`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_users_state` ON `session_users` (`session_id`,`state`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_account` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text NOT NULL,
	`end_reason` text,
	`window_index` integer DEFAULT 0 NOT NULL,
	`elapsed_ms` integer DEFAULT 0 NOT NULL,
	`discovered_count` integer DEFAULT 0 NOT NULL,
	`list_end_reached` integer DEFAULT false NOT NULL,
	`settings_json` text NOT NULL,
	`rules_version` text NOT NULL
);
