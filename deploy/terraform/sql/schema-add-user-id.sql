-- Migration: add UserId to existing Generations table (run if table already existed without UserId).
-- Ensures Users table exists first (run users.sql before this).

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Generations')
  AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Generations') AND name = 'UserId')
BEGIN
  ALTER TABLE dbo.Generations ADD UserId INT NULL;
  ALTER TABLE dbo.Generations ADD CONSTRAINT FK_Generations_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
  CREATE INDEX IX_Generations_UserId ON dbo.Generations (UserId);
END
GO
