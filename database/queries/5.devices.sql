USE [Reflexa];
GO

CREATE TABLE app.device_kits (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_device_kits PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    organization_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(150) NOT NULL,
    code NVARCHAR(100) NOT NULL, -- friendly unique code
    description NVARCHAR(500) NULL,

    owner_user_id UNIQUEIDENTIFIER NULL, -- nullable because kits can be shared
    max_pods INT NOT NULL CONSTRAINT DF_device_kits_max_pods DEFAULT 20,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_device_kits_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_device_kits_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(3) NULL,

    CONSTRAINT FK_device_kits_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT FK_device_kits_owner
        FOREIGN KEY (owner_user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_device_kits_code UNIQUE (code)
);
GO

CREATE TABLE app.hub_devices (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_hub_devices PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    device_kit_id UNIQUEIDENTIFIER NOT NULL,
    hardware_uid NVARCHAR(100) NOT NULL,
    serial_number NVARCHAR(100) NULL,
    firmware_version NVARCHAR(50) NULL,
    bluetooth_name NVARCHAR(100) NULL,

    is_active BIT NOT NULL CONSTRAINT DF_hub_devices_is_active DEFAULT 1,
    last_seen_at DATETIME2(3) NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_hub_devices_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_hub_devices_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_hub_devices_device_kit
        FOREIGN KEY (device_kit_id) REFERENCES app.device_kits(id),

    CONSTRAINT UQ_hub_devices_device_kit UNIQUE (device_kit_id),
    CONSTRAINT UQ_hub_devices_hardware_uid UNIQUE (hardware_uid)
);
GO

CREATE TABLE app.pod_devices (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_pod_devices PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    hardware_uid NVARCHAR(100) NOT NULL,
    serial_number NVARCHAR(100) NULL,
    firmware_version NVARCHAR(50) NULL,

    current_device_kit_id UNIQUEIDENTIFIER NULL,
    display_name NVARCHAR(100) NULL,
    logical_index INT NULL, -- optional slot numbering inside a kit

    battery_percent TINYINT NULL,
    battery_level NVARCHAR(20) NULL, -- HIGH / MEDIUM / LOW
    is_active BIT NOT NULL CONSTRAINT DF_pod_devices_is_active DEFAULT 1,
    last_seen_at DATETIME2(3) NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_pod_devices_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_pod_devices_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_pod_devices_current_kit
        FOREIGN KEY (current_device_kit_id) REFERENCES app.device_kits(id),

    CONSTRAINT UQ_pod_devices_hardware_uid UNIQUE (hardware_uid)
);
GO

CREATE TABLE app.pod_pairing_history (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_pod_pairing_history PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    pod_device_id UNIQUEIDENTIFIER NOT NULL,
    device_kit_id UNIQUEIDENTIFIER NOT NULL,
    paired_by_user_id UNIQUEIDENTIFIER NULL,
    paired_at DATETIME2(3) NOT NULL CONSTRAINT DF_pod_pairing_history_paired_at DEFAULT SYSUTCDATETIME(),
    unpaired_at DATETIME2(3) NULL,

    CONSTRAINT FK_pod_pairing_history_pod
        FOREIGN KEY (pod_device_id) REFERENCES app.pod_devices(id),

    CONSTRAINT FK_pod_pairing_history_kit
        FOREIGN KEY (device_kit_id) REFERENCES app.device_kits(id),

    CONSTRAINT FK_pod_pairing_history_paired_by
        FOREIGN KEY (paired_by_user_id) REFERENCES app.users(id)
);
GO

CREATE TABLE app.device_kit_user_access (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_device_kit_user_access PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    device_kit_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    can_operate BIT NOT NULL CONSTRAINT DF_device_kit_user_access_can_operate DEFAULT 0,
    can_manage BIT NOT NULL CONSTRAINT DF_device_kit_user_access_can_manage DEFAULT 0,

    granted_by_user_id UNIQUEIDENTIFIER NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_device_kit_user_access_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_device_kit_user_access_kit
        FOREIGN KEY (device_kit_id) REFERENCES app.device_kits(id),

    CONSTRAINT FK_device_kit_user_access_user
        FOREIGN KEY (user_id) REFERENCES app.users(id),

    CONSTRAINT FK_device_kit_user_access_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES app.users(id),

    CONSTRAINT UQ_device_kit_user_access UNIQUE (device_kit_id, user_id)
);
GO