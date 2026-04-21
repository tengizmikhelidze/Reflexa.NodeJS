USE [Reflexa];
GO

CREATE TABLE app.organizations (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_organizations PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    name NVARCHAR(200) NOT NULL,
    slug NVARCHAR(150) NOT NULL,
    description NVARCHAR(1000) NULL,

    is_active BIT NOT NULL CONSTRAINT DF_organizations_is_active DEFAULT 1,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_organizations_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_organizations_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(3) NULL,

    CONSTRAINT UQ_organizations_slug UNIQUE (slug)
);
GO

CREATE TABLE app.roles (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_roles PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    code NVARCHAR(50) NOT NULL, -- SUPER_ADMIN, ORG_ADMIN, TRAINER, ATHLETE, VIEWER
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500) NULL,

    CONSTRAINT UQ_roles_code UNIQUE (code)
);
GO

CREATE TABLE app.permissions (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_permissions PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    code NVARCHAR(100) NOT NULL, -- session.start, session.delete, org.manage_users, etc.
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(500) NULL,

    CONSTRAINT UQ_permissions_code UNIQUE (code)
);
GO

CREATE TABLE app.role_permissions (
    role_id UNIQUEIDENTIFIER NOT NULL,
    permission_id UNIQUEIDENTIFIER NOT NULL,

    CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),

    CONSTRAINT FK_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES app.roles(id),

    CONSTRAINT FK_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES app.permissions(id)
);
GO

CREATE TABLE app.organization_memberships (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_organization_memberships PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    organization_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,

    status NVARCHAR(30) NOT NULL CONSTRAINT DF_organization_memberships_status DEFAULT N'ACTIVE', -- INVITED, ACTIVE, SUSPENDED
    joined_at DATETIME2(3) NOT NULL CONSTRAINT DF_organization_memberships_joined_at DEFAULT SYSUTCDATETIME(),
    left_at DATETIME2(3) NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_organization_memberships_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_organization_memberships_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT FK_organization_memberships_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_organization_memberships_org_user UNIQUE (organization_id, user_id)
);
GO

CREATE TABLE app.organization_membership_roles (
    organization_membership_id UNIQUEIDENTIFIER NOT NULL,
    role_id UNIQUEIDENTIFIER NOT NULL,

    CONSTRAINT PK_organization_membership_roles PRIMARY KEY (organization_membership_id, role_id),

    CONSTRAINT FK_organization_membership_roles_membership
        FOREIGN KEY (organization_membership_id) REFERENCES app.organization_memberships(id),

    CONSTRAINT FK_organization_membership_roles_role
        FOREIGN KEY (role_id) REFERENCES app.roles(id)
);
GO

CREATE TABLE app.user_permission_grants (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_user_permission_grants PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    organization_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    permission_id UNIQUEIDENTIFIER NOT NULL,
    granted_by_user_id UNIQUEIDENTIFIER NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_user_permission_grants_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_user_permission_grants_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT FK_user_permission_grants_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT FK_user_permission_grants_permission
        FOREIGN KEY (permission_id) REFERENCES app.permissions(id),

    CONSTRAINT FK_user_permission_grants_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_user_permission_grants UNIQUE (organization_id, user_id, permission_id)
);
GO

CREATE TABLE app.teams (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_teams PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    organization_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(500) NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_teams_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_teams_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(3) NULL,

    CONSTRAINT FK_teams_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT UQ_teams_org_name UNIQUE (organization_id, name)
);
GO

CREATE TABLE app.team_memberships (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_team_memberships PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    team_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_team_memberships_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_team_memberships_team
        FOREIGN KEY (team_id) REFERENCES app.teams(id),

    CONSTRAINT FK_team_memberships_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_team_memberships_team_user UNIQUE (team_id, user_id)
);
GO

CREATE TABLE app.viewer_access_scopes (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_viewer_access_scopes PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    organization_id UNIQUEIDENTIFIER NOT NULL,
    viewer_user_id UNIQUEIDENTIFIER NOT NULL,
    target_user_id UNIQUEIDENTIFIER NOT NULL,
    granted_by_user_id UNIQUEIDENTIFIER NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_viewer_access_scopes_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_viewer_access_scopes_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT FK_viewer_access_scopes_viewer
        FOREIGN KEY (viewer_user_id) REFERENCES app.users(id),

    CONSTRAINT FK_viewer_access_scopes_target
        FOREIGN KEY (target_user_id) REFERENCES app.users(id),

    CONSTRAINT FK_viewer_access_scopes_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_viewer_access_scopes UNIQUE (organization_id, viewer_user_id, target_user_id)
);
GO