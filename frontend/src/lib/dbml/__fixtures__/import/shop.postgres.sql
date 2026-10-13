CREATE TABLE users (
  id integer PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE orders (
  id integer PRIMARY KEY,
  user_id integer NOT NULL,
  total numeric(10,2) DEFAULT 0,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX orders_user_idx ON orders (user_id);
