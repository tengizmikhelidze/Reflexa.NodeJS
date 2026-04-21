USE [Reflexa];
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.schemas
    WHERE name = N'app'
)
BEGIN
    EXEC('CREATE SCHEMA app');
END
GO