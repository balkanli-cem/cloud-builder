-- Per-user clients + optional link on Generations. Run after users.sql / schema.sql.
-- Connection: same database as AZURE_SQL_CONNECTION_STRING.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Clients')
BEGIN
  CREATE TABLE dbo.Clients (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    UserId    INT NOT NULL,
    Name      NVARCHAR(256) NOT NULL,
    CreatedAt DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Clients_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
    CONSTRAINT UQ_Clients_User_Name UNIQUE (UserId, Name)
  );
  CREATE INDEX IX_Clients_UserId ON dbo.Clients (UserId);
END
GO

IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Generations') AND name = 'ClientId'
)
BEGIN
  ALTER TABLE dbo.Generations ADD ClientId INT NULL;
  ALTER TABLE dbo.Generations ADD CONSTRAINT FK_Generations_Clients
    FOREIGN KEY (ClientId) REFERENCES dbo.Clients(Id) ON DELETE SET NULL;
  CREATE INDEX IX_Generations_ClientId ON dbo.Generations (ClientId);
END
GO
