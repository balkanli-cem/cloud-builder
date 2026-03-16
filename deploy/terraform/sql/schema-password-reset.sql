-- Password reset: token and expiry on Users (run after users.sql).
-- Used by forgot-password flow: token is hashed before storage.

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'PasswordResetTokenHash')
BEGIN
  ALTER TABLE dbo.Users ADD
    PasswordResetTokenHash NVARCHAR(256) NULL,
    PasswordResetExpiresAt DATETIME2(7) NULL;
END
GO
