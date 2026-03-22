-- Login audit trail and active sessions (run against the same DB as the app).
-- Enables: historical logins per user, concurrent "active" users via session activity.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserLoginEvents')
BEGIN
  CREATE TABLE dbo.UserLoginEvents (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    UserId     INT NULL,
    Email      NVARCHAR(256) NOT NULL,
    Success    BIT NOT NULL,
    LoginAt    DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    IpAddress  NVARCHAR(45) NULL,
    UserAgent  NVARCHAR(512) NULL,
    CONSTRAINT FK_UserLoginEvents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );

  CREATE INDEX IX_UserLoginEvents_UserId_LoginAt ON dbo.UserLoginEvents (UserId, LoginAt DESC);
  CREATE INDEX IX_UserLoginEvents_LoginAt ON dbo.UserLoginEvents (LoginAt DESC);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserSessions')
BEGIN
  CREATE TABLE dbo.UserSessions (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    UserId           INT NOT NULL,
    Jti              CHAR(36) NOT NULL,
    CreatedAt        DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    LastActivityAt   DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    IpAddress        NVARCHAR(45) NULL,
    UserAgent        NVARCHAR(512) NULL,
    RevokedAt        DATETIME2(7) NULL,
    CONSTRAINT UQ_UserSessions_Jti UNIQUE (Jti),
    CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );

  CREATE INDEX IX_UserSessions_UserId ON dbo.UserSessions (UserId);
  CREATE INDEX IX_UserSessions_Active ON dbo.UserSessions (LastActivityAt DESC)
    WHERE RevokedAt IS NULL;
END
GO
