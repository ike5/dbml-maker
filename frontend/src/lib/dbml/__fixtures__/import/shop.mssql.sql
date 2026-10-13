CREATE TABLE [users] (
  [id] int IDENTITY(1,1) PRIMARY KEY,
  [email] nvarchar(255) NOT NULL UNIQUE,
  [active] bit NOT NULL DEFAULT 1
);
GO

CREATE TABLE [orders] (
  [id] int IDENTITY(1,1) PRIMARY KEY,
  [user_id] int NOT NULL,
  [total] decimal(10,2) DEFAULT 0,
  CONSTRAINT [fk_orders_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id])
);
GO
