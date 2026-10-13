CREATE USER "core"
NO AUTHENTICATION
DEFAULT TABLESPACE system
TEMPORARY TABLESPACE temp
QUOTA UNLIMITED ON system;

CREATE USER "sales"
NO AUTHENTICATION
DEFAULT TABLESPACE system
TEMPORARY TABLESPACE temp
QUOTA UNLIMITED ON system;

CREATE TABLE "core"."users" (
  "id" integer GENERATED AS IDENTITY PRIMARY KEY,
  "email" varchar(255) UNIQUE NOT NULL,
  "name" varchar(100) DEFAULT 'anonymous',
  "score" decimal(10,2) DEFAULT -1.5,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "retries" integer DEFAULT 0,
  "region_id" integer
);

CREATE TABLE "core"."regions" (
  "id" integer PRIMARY KEY,
  "name" varchar(50)
);

CREATE TABLE "core"."orders" (
  "id" integer PRIMARY KEY,
  "user_id" integer NOT NULL,
  "status" nvarchar2(255) CHECK ("status" IN ('pending', 'paid', 'shipped')) DEFAULT 'pending' NOT NULL,
  "tags" varchar[]
);

CREATE TABLE "sales"."invoices" (
  "order_id" integer,
  "line" integer,
  "total" decimal(10,2),
  PRIMARY KEY ("order_id", "line")
);

CREATE TABLE "sales"."invoice_notes" (
  "order_id" integer,
  "line" integer,
  "text" text
);

CREATE TABLE "sales"."profiles" (
  "user_id" integer PRIMARY KEY
);

CREATE TABLE "sales"."tags" (
  "id" integer PRIMARY KEY
);

CREATE TABLE "sales"."order_tags" (
  "id" integer PRIMARY KEY
);

CREATE TABLE "sales"."tags_order_tags" (
  "tags_id" integer,
  "order_tags_id" integer,
  PRIMARY KEY ("tags_id", "order_tags_id")
);

CREATE UNIQUE INDEX "users_email_name" ON "core"."users" ("email", "name");

CREATE INDEX ON "core"."users" (lower(name));

CREATE INDEX ON "core"."users" ("created_at");

COMMENT ON TABLE "core"."users" IS 'The first line of the note.
The second line of the note.
';

COMMENT ON COLUMN "core"."users"."email" IS 'Unique and lower case.';

GRANT REFERENCES ON "sales"."profiles" TO PUBLIC;

ALTER TABLE "core"."users" ADD FOREIGN KEY ("region_id") REFERENCES "core"."regions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY ("user_id") REFERENCES "core"."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sales"."invoice_notes" ADD FOREIGN KEY ("order_id", "line") REFERENCES "sales"."invoices" ("order_id", "line") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."users" ADD FOREIGN KEY ("id") REFERENCES "sales"."profiles" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sales"."tags_order_tags" ADD FOREIGN KEY ("tags_id") REFERENCES "sales"."tags" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sales"."tags_order_tags" ADD FOREIGN KEY ("order_tags_id") REFERENCES "sales"."order_tags" ("id") DEFERRABLE INITIALLY IMMEDIATE;
