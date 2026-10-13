CREATE TABLE "users" (
  "id" integer PRIMARY KEY,
  "name" varchar(100) NOT NULL
);

CREATE TABLE "posts" (
  "id" integer PRIMARY KEY,
  "user_id" integer,
  "title" varchar(200)
);

ALTER TABLE "posts" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
