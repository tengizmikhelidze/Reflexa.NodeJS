USE [Reflexa];
GO

CREATE TABLE app.training_presets (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_training_presets PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    organization_id UNIQUEIDENTIFIER NULL, -- NULL means personal preset
    created_by_user_id UNIQUEIDENTIFIER NOT NULL,

    scope NVARCHAR(20) NOT NULL, -- USER / ORGANIZATION
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(500) NULL,

    config_json NVARCHAR(MAX) NOT NULL, -- session config payload

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_training_presets_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_training_presets_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(3) NULL,

    CONSTRAINT FK_training_presets_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT FK_training_presets_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES app.users(id)
);
GO