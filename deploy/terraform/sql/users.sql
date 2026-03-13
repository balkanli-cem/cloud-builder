-- Users table for login / authentication (run when you add a login page).
-- Run against the same Azure SQL database as the app (AZURE_SQL_CONNECTION_STRING).

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
  CREATE TABLE dbo.Users (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Email        NVARCHAR(256) NOT NULL,
    PasswordHash NVARCHAR(256) NOT NULL,
    DisplayName  NVARCHAR(128) NULL,
    CreatedAt    DATETIME2(7)  NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt    DATETIME2(7)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
  );

  CREATE INDEX IX_Users_Email ON dbo.Users (Email);
END
GO
