import {
    TrainingSessionRow,
    TrainingSessionActivePodRow,
    TrainingSessionEventRow,
    SessionSummary,
    SessionDetail,
    ActivePodItem,
    SessionEventItem,
} from './sessions.types.js';

export function mapSessionSummary(row: TrainingSessionRow): SessionSummary {
    return {
        id:               row.id,
        organizationId:   row.organization_id,
        deviceKitId:      row.device_kit_id,
        hubDeviceId:      row.hub_device_id,

        startedByUserId:  row.started_by_user_id,
        assignedToUserId: row.assigned_to_user_id,
        assignedByUserId: row.assigned_by_user_id,
        teamId:           row.team_id,

        origin:          row.origin,
        syncStatus:      row.sync_status,
        clientSessionId: row.client_session_id,

        status:       row.status,
        endMode:      row.end_mode,
        presetId:     row.preset_id,
        trainingMode: row.training_mode,

        sessionStartedAt: row.session_started_at,
        sessionEndedAt:   row.session_ended_at,
        durationMs:       row.duration_ms,

        score:           row.score,
        hitCount:        row.hit_count,
        missCount:       row.miss_count,
        accuracyPercent: row.accuracy_percent,

        avgReactionMs:   row.avg_reaction_ms,
        bestReactionMs:  row.best_reaction_ms,
        worstReactionMs: row.worst_reaction_ms,

        activePodCount:   row.active_pod_count,
        totalEventsCount: row.total_events_count,
        notes:            row.notes,

        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function mapActivePod(row: TrainingSessionActivePodRow): ActivePodItem {
    return {
        id:          row.id,
        podDeviceId: row.pod_device_id,
        podOrder:    row.pod_order,
    };
}

export function mapSessionEvent(row: TrainingSessionEventRow): SessionEventItem {
    return {
        id:             row.id,
        podDeviceId:    row.pod_device_id,
        eventIndex:     row.event_index,
        eventType:      row.event_type,
        eventTimestamp: row.event_timestamp,
        elapsedMs:      row.elapsed_ms,
        reactionTimeMs: row.reaction_time_ms,
        isCorrect:      row.is_correct,
        payloadJson:    row.payload_json ? (JSON.parse(row.payload_json) as Record<string, unknown>) : null,
    };
}

export function mapSessionDetail(
    row: TrainingSessionRow,
    pods: TrainingSessionActivePodRow[],
    events: TrainingSessionEventRow[]
): SessionDetail {
    let configJson: Record<string, unknown> = {};
    try { configJson = JSON.parse(row.config_json) as Record<string, unknown>; } catch { /* corrupt DB value — return empty object */ }

    return {
        ...mapSessionSummary(row),
        configJson,
        activePods: pods.map(mapActivePod),
        events:     events.map(mapSessionEvent),
    };
}

