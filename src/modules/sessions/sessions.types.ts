// ─── DB Row Types ─────────────────────────────────────────────────────────────

export interface TrainingSessionRow {
    id: string;
    organization_id: string;
    device_kit_id: string;
    hub_device_id: string | null;

    started_by_user_id: string | null;
    assigned_to_user_id: string | null;
    assigned_by_user_id: string | null;
    team_id: string | null;

    origin: string;
    sync_status: string;
    client_session_id: string | null;

    status: string;
    end_mode: string;
    preset_id: string | null;
    training_mode: string;
    config_json: string;

    session_started_at: Date;
    session_ended_at: Date;
    duration_ms: number;

    score: number | null;
    hit_count: number;
    miss_count: number;
    accuracy_percent: number | null;

    avg_reaction_ms: number | null;
    best_reaction_ms: number | null;
    worst_reaction_ms: number | null;

    active_pod_count: number;
    total_events_count: number;
    notes: string | null;

    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface TrainingSessionActivePodRow {
    id: string;
    training_session_id: string;
    pod_device_id: string;
    pod_order: number | null;
}

export interface TrainingSessionEventRow {
    id: string;
    training_session_id: string;
    pod_device_id: string | null;

    event_index: number;
    event_type: string;
    event_timestamp: Date;
    elapsed_ms: number | null;

    reaction_time_ms: number | null;
    is_correct: boolean | null;
    payload_json: string | null;

    created_at: Date;
}

// ─── Request Inputs ───────────────────────────────────────────────────────────

export interface SyncSessionActivePodInput {
    podDeviceId: string;
    podOrder?: number;
}

export interface SyncSessionEventInput {
    podDeviceId?: string;
    eventIndex: number;
    eventType: string;
    eventTimestamp: string; // ISO 8601
    elapsedMs?: number;
    reactionTimeMs?: number;
    isCorrect?: boolean;
    payloadJson?: Record<string, unknown>;
}

export interface SyncSessionInput {
    clientSessionId: string;
    organizationId: string;
    deviceKitId: string;
    hubDeviceId?: string;

    startedByUserId?: string;
    assignedToUserId?: string;
    teamId?: string;

    origin: 'OFFLINE_SYNC' | 'WEB' | 'ADMIN_CREATE';
    status: 'COMPLETED' | 'CANCELLED' | 'FAILED';
    endMode: 'TIME' | 'TARGET' | 'REPETITION' | 'EARLY_END';
    presetId?: string;
    trainingMode: string;
    configJson: Record<string, unknown>;

    sessionStartedAt: string; // ISO 8601
    sessionEndedAt: string;   // ISO 8601
    durationMs: number;

    score?: number;
    hitCount: number;
    missCount: number;
    accuracyPercent?: number;

    avgReactionMs?: number;
    bestReactionMs?: number;
    worstReactionMs?: number;

    notes?: string;

    activePods?: SyncSessionActivePodInput[];
    events?: SyncSessionEventInput[];
}

export interface ListSessionsFilters {
    organizationId?: string;
    assignedToUserId?: string;
    teamId?: string;
}

export interface AssignSessionInput {
    assignedToUserId?: string | null;
    teamId?: string | null;
}

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface ActivePodItem {
    id: string;
    podDeviceId: string;
    podOrder: number | null;
}

export interface SessionEventItem {
    id: string;
    podDeviceId: string | null;
    eventIndex: number;
    eventType: string;
    eventTimestamp: Date;
    elapsedMs: number | null;
    reactionTimeMs: number | null;
    isCorrect: boolean | null;
    payloadJson: Record<string, unknown> | null;
}

export interface SessionSummary {
    id: string;
    organizationId: string;
    deviceKitId: string;
    hubDeviceId: string | null;

    startedByUserId: string | null;
    assignedToUserId: string | null;
    assignedByUserId: string | null;
    teamId: string | null;

    origin: string;
    syncStatus: string;
    clientSessionId: string | null;

    status: string;
    endMode: string;
    presetId: string | null;
    trainingMode: string;

    sessionStartedAt: Date;
    sessionEndedAt: Date;
    durationMs: number;

    score: number | null;
    hitCount: number;
    missCount: number;
    accuracyPercent: number | null;

    avgReactionMs: number | null;
    bestReactionMs: number | null;
    worstReactionMs: number | null;

    activePodCount: number;
    totalEventsCount: number;
    notes: string | null;

    createdAt: Date;
    updatedAt: Date;
}

export interface SessionDetail extends SessionSummary {
    configJson: Record<string, unknown>;
    activePods: ActivePodItem[];
    events: SessionEventItem[];
}

