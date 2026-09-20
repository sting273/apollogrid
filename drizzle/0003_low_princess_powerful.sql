CREATE TABLE `postcode_address_cache` (
	`postcode` text PRIMARY KEY NOT NULL,
	`addresses_json` text NOT NULL,
	`cached_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
