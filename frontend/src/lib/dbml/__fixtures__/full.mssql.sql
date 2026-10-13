CREATE SCHEMA [core]
GO

CREATE SCHEMA [sales]
GO

CREATE TABLE [core].[users] (
  [id] integer PRIMARY KEY IDENTITY(1, 1),
  [email] varchar(255) UNIQUE NOT NULL,
  [name] varchar(100) DEFAULT 'anonymous',
  [score] decimal(10,2) DEFAULT (-1.5),
  [active] boolean NOT NULL DEFAULT (true),
  [created_at] timestamp DEFAULT (now()),
  [retries] integer DEFAULT (0),
  [region_id] integer
)
GO

CREATE TABLE [core].[regions] (
  [id] integer PRIMARY KEY,
  [name] varchar(50)
)
GO

CREATE TABLE [core].[orders] (
  [id] integer PRIMARY KEY,
  [user_id] integer NOT NULL,
  [status] nvarchar(255) CHECK ([status] IN ('pending', 'paid', 'shipped')) NOT NULL DEFAULT 'pending',
  [tags] varchar[]
)
GO

CREATE TABLE [sales].[invoices] (
  [order_id] integer,
  [line] integer,
  [total] decimal(10,2),
  PRIMARY KEY ([order_id], [line])
)
GO

CREATE TABLE [sales].[invoice_notes] (
  [order_id] integer,
  [line] integer,
  [text] text
)
GO

CREATE TABLE [sales].[profiles] (
  [user_id] integer PRIMARY KEY
)
GO

CREATE TABLE [sales].[tags] (
  [id] integer PRIMARY KEY
)
GO

CREATE TABLE [sales].[order_tags] (
  [id] integer PRIMARY KEY
)
GO

CREATE UNIQUE INDEX [users_email_name] ON [core].[users] ("email", "name")
GO

CREATE INDEX [users_index_1] ON [core].[users] ((lower(name)))
GO

CREATE INDEX [users_index_2] ON [core].[users] ("created_at")
GO

EXEC sp_addextendedproperty
@name = N'Table_Description',
@value = 'The first line of the note.
The second line of the note.
',
@level0type = N'Schema', @level0name = 'core',
@level1type = N'Table',  @level1name = 'users';
GO

EXEC sp_addextendedproperty
@name = N'Column_Description',
@value = 'Unique and lower case.',
@level0type = N'Schema', @level0name = 'core',
@level1type = N'Table',  @level1name = 'users',
@level2type = N'Column', @level2name = 'email';
GO

ALTER TABLE [core].[users] ADD FOREIGN KEY ([region_id]) REFERENCES [core].[regions] ([id])
GO

ALTER TABLE [core].[orders] ADD CONSTRAINT [fk_orders_user] FOREIGN KEY ([user_id]) REFERENCES [core].[users] ([id]) ON DELETE CASCADE ON UPDATE SET NULL
GO

ALTER TABLE [sales].[invoice_notes] ADD FOREIGN KEY ([order_id], [line]) REFERENCES [sales].[invoices] ([order_id], [line])
GO

ALTER TABLE [core].[users] ADD FOREIGN KEY ([id]) REFERENCES [sales].[profiles] ([user_id])
GO

CREATE TABLE [sales].[tags_order_tags] (
  [tags_id] integer,
  [order_tags_id] integer,
  PRIMARY KEY ([tags_id], [order_tags_id])
);
GO

ALTER TABLE [sales].[tags_order_tags] ADD FOREIGN KEY ([tags_id]) REFERENCES [sales].[tags] ([id]);
GO

ALTER TABLE [sales].[tags_order_tags] ADD FOREIGN KEY ([order_tags_id]) REFERENCES [sales].[order_tags] ([id]);
GO

