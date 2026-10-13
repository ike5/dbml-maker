CREATE SCHEMA `core`;

CREATE SCHEMA `sales`;

CREATE TABLE `core`.`users` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `email` varchar(255) UNIQUE NOT NULL COMMENT 'Unique and lower case.',
  `name` varchar(100) DEFAULT 'anonymous',
  `score` decimal(10,2) DEFAULT -1.5,
  `active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp DEFAULT (now()),
  `retries` integer DEFAULT 0,
  `region_id` integer
);

CREATE TABLE `core`.`regions` (
  `id` integer PRIMARY KEY,
  `name` varchar(50)
);

CREATE TABLE `core`.`orders` (
  `id` integer PRIMARY KEY,
  `user_id` integer NOT NULL,
  `status` ENUM ('pending', 'paid', 'shipped') NOT NULL DEFAULT 'pending',
  `tags` varchar[]
);

CREATE TABLE `sales`.`invoices` (
  `order_id` integer,
  `line` integer,
  `total` decimal(10,2),
  PRIMARY KEY (`order_id`, `line`)
);

CREATE TABLE `sales`.`invoice_notes` (
  `order_id` integer,
  `line` integer,
  `text` text
);

CREATE TABLE `sales`.`profiles` (
  `user_id` integer PRIMARY KEY
);

CREATE TABLE `sales`.`tags` (
  `id` integer PRIMARY KEY
);

CREATE TABLE `sales`.`order_tags` (
  `id` integer PRIMARY KEY
);

CREATE UNIQUE INDEX `users_email_name` ON `core`.`users` (`email`, `name`);

CREATE INDEX ``core`.users_index_1` ON `core`.`users` ((lower(name))) USING HASH;

CREATE INDEX ``core`.users_index_2` ON `core`.`users` (`created_at`);

ALTER TABLE `core`.`users` COMMENT = 'The first line of the note.
The second line of the note.
';

ALTER TABLE `core`.`users` ADD FOREIGN KEY (`region_id`) REFERENCES `core`.`regions` (`id`);

ALTER TABLE `core`.`orders` ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `core`.`users` (`id`) ON DELETE CASCADE ON UPDATE SET NULL;

ALTER TABLE `sales`.`invoice_notes` ADD FOREIGN KEY (`order_id`, `line`) REFERENCES `sales`.`invoices` (`order_id`, `line`);

ALTER TABLE `core`.`users` ADD FOREIGN KEY (`id`) REFERENCES `sales`.`profiles` (`user_id`);

CREATE TABLE `sales`.`tags_order_tags` (
  `tags_id` integer,
  `order_tags_id` integer,
  PRIMARY KEY (`tags_id`, `order_tags_id`)
);

ALTER TABLE `sales`.`tags_order_tags` ADD FOREIGN KEY (`tags_id`) REFERENCES `sales`.`tags` (`id`);

ALTER TABLE `sales`.`tags_order_tags` ADD FOREIGN KEY (`order_tags_id`) REFERENCES `sales`.`order_tags` (`id`);

