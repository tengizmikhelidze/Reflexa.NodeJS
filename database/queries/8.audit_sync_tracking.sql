USE [Reflexa];
GO

CREATE TABLE app.sync_batches (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_sync_batches PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    user_id UNIQUEIDENTIFIER NOT NULL,
    organization_id UNIQUEIDENTIFIER NOT NULL,
    client_device_id NVARCHAR(100) NULL,
    synced_at DATETIME2(3) NOT NULL CONSTRAINT DF_sync_batches_synced_at DEFAULT SYSUTCDATETIME(),

    total_sessions_selected INT NOT NULL,
    total_sessions_synced INT NOT NULL,
    total_sessions_rejected INT NOT NULL CONSTRAINT DF_sync_batches_total_sessions_rejected DEFAULT 0,

    CONSTRAINT FK_sync_batches_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT FK_sync_batches_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id)
);
GO

CREATE TABLE app.audit_logs (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_audit_logs PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    actor_user_id UNIQUEIDENTIFIER NULL,
    organization_id UNIQUEIDENTIFIER NULL,
    entity_type NVARCHAR(100) NOT NULL,
    entity_id UNIQUEIDENTIFIER NULL,
    action NVARCHAR(100) NOT NULL,
    details_json NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_audit_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES app.users(id),

    CONSTRAINT FK_audit_logs_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id)
);
GO