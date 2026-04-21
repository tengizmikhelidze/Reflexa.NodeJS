USE [Reflexa];
GO

CREATE TABLE app.training_sessions (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_training_sessions PRIMARY KEY,

    organization_id UNIQUEIDENTIFIER NOT NULL,
    device_kit_id UNIQUEIDENTIFIER NOT NULL,
    hub_device_id UNIQUEIDENTIFIER NULL,

    started_by_user_id UNIQUEIDENTIFIER NULL, -- who operated the session
    assigned_to_user_id UNIQUEIDENTIFIER NULL, -- athlete/user who owns the result
    assigned_by_user_id UNIQUEIDENTIFIER NULL,

    team_id UNIQUEIDENTIFIER NULL,

    origin NVARCHAR(20) NOT NULL, -- OFFLINE_SYNC / WEB / ADMIN_CREATE
    sync_status NVARCHAR(20) NOT NULL CONSTRAINT DF_training_sessions_sync_status DEFAULT N'SYNCED',
    client_session_id NVARCHAR(100) NULL, -- original client UUID if needed

    status NVARCHAR(20) NOT NULL, -- COMPLETED / CANCELLED / FAILED
    end_mode NVARCHAR(20) NOT NULL, -- TIME / TARGET / REPETITION / EARLY_END

    preset_id UNIQUEIDENTIFIER NULL,

    training_mode NVARCHAR(50) NOT NULL,
    config_json NVARCHAR(MAX) NOT NULL,

    session_started_at DATETIME2(3) NOT NULL,
    session_ended_at DATETIME2(3) NOT NULL,
    duration_ms BIGINT NOT NULL,

    score INT NULL,
    hit_count INT NOT NULL CONSTRAINT DF_training_sessions_hit_count DEFAULT 0,
    miss_count INT NOT NULL CONSTRAINT DF_training_sessions_miss_count DEFAULT 0,
    accuracy_percent DECIMAL(5,2) NULL,

    avg_reaction_ms DECIMAL(10,2) NULL,
    best_reaction_ms DECIMAL(10,2) NULL,
    worst_reaction_ms DECIMAL(10,2) NULL,

    active_pod_count INT NOT NULL,
    total_events_count INT NOT NULL CONSTRAINT DF_training_sessions_total_events_count DEFAULT 0,

    notes NVARCHAR(1000) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_training_sessions_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_training_sessions_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2(3) NULL,

    CONSTRAINT FK_training_sessions_org
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id),

    CONSTRAINT FK_training_sessions_kit
        FOREIGN KEY (device_kit_id) REFERENCES app.device_kits(id),

    CONSTRAINT FK_training_sessions_hub
        FOREIGN KEY (hub_device_id) REFERENCES app.hub_devices(id),

    CONSTRAINT FK_training_sessions_started_by
        FOREIGN KEY (started_by_user_id) REFERENCES app.users(id),

    CONSTRAINT FK_training_sessions_assigned_to
        FOREIGN KEY (assigned_to_user_id) REFERENCES app.users(id),

    CONSTRAINT FK_training_sessions_assigned_by
        FOREIGN KEY (assigned_by_user_id) REFERENCES app.users(id),

    CONSTRAINT FK_training_sessions_team
        FOREIGN KEY (team_id) REFERENCES app.teams(id),

    CONSTRAINT FK_training_sessions_preset
        FOREIGN KEY (preset_id) REFERENCES app.training_presets(id),

    CONSTRAINT UQ_training_sessions_client_session UNIQUE (organization_id, client_session_id)
);
GO

CREATE TABLE app.training_session_active_pods (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_training_session_active_pods PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    training_session_id UNIQUEIDENTIFIER NOT NULL,
    pod_device_id UNIQUEIDENTIFIER NOT NULL,

    pod_order INT NULL,

    CONSTRAINT FK_training_session_active_pods_session
        FOREIGN KEY (training_session_id) REFERENCES app.training_sessions(id),

    CONSTRAINT FK_training_session_active_pods_pod
        FOREIGN KEY (pod_device_id) REFERENCES app.pod_devices(id),

    CONSTRAINT UQ_training_session_active_pods UNIQUE (training_session_id, pod_device_id)
);
GO

CREATE TABLE app.training_session_events (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_training_session_events PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    training_session_id UNIQUEIDENTIFIER NOT NULL,
    pod_device_id UNIQUEIDENTIFIER NULL,

    event_index INT NOT NULL,
    event_type NVARCHAR(50) NOT NULL, -- POD_LIT, POD_HIT, POD_MISS, POD_TIMEOUT, BATTERY, etc.
    event_timestamp DATETIME2(3) NOT NULL,
    elapsed_ms BIGINT NULL,

    reaction_time_ms DECIMAL(10,2) NULL,
    is_correct BIT NULL,

    payload_json NVARCHAR(MAX) NULL,

    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_training_session_events_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_training_session_events_session
        FOREIGN KEY (training_session_id) REFERENCES app.training_sessions(id),

    CONSTRAINT FK_training_session_events_pod
        FOREIGN KEY (pod_device_id) REFERENCES app.pod_devices(id),

    CONSTRAINT UQ_training_session_events_session_index UNIQUE (training_session_id, event_index)
);
GO