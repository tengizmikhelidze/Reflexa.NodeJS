USE master;
GO

IF DB_ID(N'Reflexa') IS NULL
BEGIN
    CREATE DATABASE [Reflexa];
END
GO

USE [Reflexa];
GO