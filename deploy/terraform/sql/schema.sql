-- Run this once against the Azure SQL database after Terraform apply.
-- Connection: use the same server/database as the app (AZURE_SQL_CONNECTION_STRING).

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Generations')
BEGIN
  CREATE TABLE dbo.Generations (
    Id                INT IDENTITY(1,1) PRIMARY KEY,
    ProjectName       NVARCHAR(256) NOT NULL,
    ResourceGroupName NVARCHAR(256) NOT NULL,
    Region            NVARCHAR(64)  NOT NULL,
    NetworkJson       NVARCHAR(MAX) NOT NULL,
    ServicesJson      NVARCHAR(MAX) NOT NULL,
    Format            NVARCHAR(32)  NOT NULL,  -- 'bicep' or 'terraform'
    CreatedAt         DATETIME2(7)  NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_Generations_CreatedAt ON dbo.Generations (CreatedAt DESC);
  CREATE INDEX IX_Generations_ProjectName ON dbo.Generations (ProjectName);
END
GO
