USE [Reflexa];
GO

CREATE TABLE app.users (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_users PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    email NVARCHAR(320) NOT NULL,
    normalized_email AS UPPER(email) PERSISTED,
    password_hash NVARCHAR(512) NULL,
    email_verified BIT NOT NULL CONSTRAINT DF_users_email_verified DEFAULT 0,

    first_name NVARCHAR(100) NULL,
    last_name NVARCHAR(100) NULL,
    display_name NVARCHAR(200) NULL,
    avatar_url NVARCHAR(1000) NULL,

    is_super_admin BIT NOT NULL CONSTRAINT DF_users_is_super_admin DEFAULT 0,
    is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT 1,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(3) NULL,

    CONSTRAINT UQ_users_email UNIQUE (normalized_email)
);
GO

CREATE TABLE app.external_identities (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_external_identities PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    user_id UNIQUEIDENTIFIER NOT NULL,
    provider NVARCHAR(50) NOT NULL, -- GOOGLE, APPLE, etc.
    provider_user_id NVARCHAR(255) NOT NULL,
    provider_email NVARCHAR(320) NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_external_identities_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_external_identities_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_external_identities_provider_user UNIQUE (provider, provider_user_id)
);
GO

CREATE TABLE app.email_verification_tokens (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_email_verification_tokens PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    user_id UNIQUEIDENTIFIER NOT NULL,
    token NVARCHAR(255) NOT NULL,
    expires_at DATETIME2(3) NOT NULL,
    used_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_email_verification_tokens_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_email_verification_tokens_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_email_verification_tokens_token UNIQUE (token)
);
GO

CREATE TABLE app.refresh_tokens (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_refresh_tokens PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    user_id UNIQUEIDENTIFIER NOT NULL,
    token_hash NVARCHAR(512) NOT NULL,
    expires_at DATETIME2(3) NOT NULL,
    revoked_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_refresh_tokens_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_refresh_tokens_token_hash UNIQUE (token_hash)
);
GO