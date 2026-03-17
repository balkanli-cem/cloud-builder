-- IaC validation result per generation (run after schema.sql).
-- ValidationStatus: success, warning, error, skipped (NULL = not run).

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Generations') AND name = 'ValidationStatus')
BEGIN
  ALTER TABLE dbo.Generations ADD
    ValidationStatus  NVARCHAR(20)  NULL,
    ValidationMessage  NVARCHAR(MAX) NULL;
END
GO
