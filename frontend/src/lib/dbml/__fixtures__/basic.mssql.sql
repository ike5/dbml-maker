CREATE TABLE [users] (
  [id] integer PRIMARY KEY,
  [name] varchar(100) NOT NULL
)
GO

CREATE TABLE [posts] (
  [id] integer PRIMARY KEY,
  [user_id] integer,
  [title] varchar(200)
)
GO

ALTER TABLE [posts] ADD FOREIGN KEY ([user_id]) REFERENCES [users] ([id])
GO
