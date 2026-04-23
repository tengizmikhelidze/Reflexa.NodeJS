import sql from 'mssql';
import {
    TrainingSessionRow,
    TrainingSessionActivePodRow,
    TrainingSessionEventRow,
    ListSessionsFilters,
} from './sessions.types.js';

export interface CreateSessionData {
    id: string;
    organizationId: string;
    deviceKitId: string;
    hubDeviceId?: string;

    startedByUserId?: string;
    assignedToUserId?: string;
    teamId?: string;

    origin: string;
    clientSessionId: string;
    status: string;
    endMode: string;
    presetId?: string;
    trainingMode: string;
    configJson: string; // pre-serialised JSON string

    sessionStartedAt: Date;
    sessionEndedAt: Date;
    durationMs: number;

    score?: number;
    hitCount: number;
    missCount: number;
    accuracyPercent?: number;

    avgReactionMs?: number;
    bestReactionMs?: number;
    worstReactionMs?: number;

    activePodCount: number;
    totalEventsCount: number;
    notes?: string;
}

export interface CreateActivePodData {
    trainingSessionId: string;
    podDeviceId: string;
    podOrder?: number;
}

export interface CreateEventData {
    trainingSessionId: string;
    podDeviceId?: string;
    eventIndex: number;
    eventType: string;
    eventTimestamp: Date;
    elapsedMs?: number;
    reactionTimeMs?: number;
    isCorrect?: boolean;
    payloadJson?: string; // pre-serialised JSON string
}

export interface UpdateAssignmentData {
    assignedToUserId?: string | null;
    teamId?: string | null;
    assignedByUserId: string;
}

export class SessionsRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    // ── Idempotency Check ─────────────────────────────────────────────────────

    /**
     * Returns an existing session if it was already synced with the same
     * (organization_id, client_session_id) pair. Includes deleted sessions
     * so re-sync of a deleted session is properly detected.
     */
    async findByClientSessionId(
        organizationId: string,
        clientSessionId: string
    ): Promise<TrainingSessionRow | null> {
        const result = await this.pool
            .request()
            .input('organizationId',  sql.UniqueIdentifier, organizationId)
            .input('clientSessionId', sql.NVarChar(100),     clientSessionId)
            .query<TrainingSessionRow>(`
                SELECT
                    id, organization_id, device_kit_id, hub_device_id,
                    started_by_user_id, assigned_to_user_id, assigned_by_user_id, team_id,
                    origin, sync_status, client_session_id,
                    status, end_mode, preset_id, training_mode, config_json,
                    session_started_at, session_ended_at, duration_ms,
                    score, hit_count, miss_count, accuracy_percent,
                    avg_reaction_ms, best_reaction_ms, worst_reaction_ms,
                    active_pod_count, total_events_count, notes,
                    created_at, updated_at, deleted_at
                FROM app.training_sessions
                WHERE organization_id   = @organizationId
                  AND client_session_id = @clientSessionId
            `);
        return result.recordset[0] ?? null;
    }

    // ── Sync (transactional) ──────────────────────────────────────────────────

    /**
     * Inserts session + active pods + events in a single transaction.
     * Caller must ensure idempotency check has already run.
     */
    async syncSession(
        sessionData: CreateSessionData,
        pods: CreateActivePodData[],
        events: CreateEventData[]
    ): Promise<TrainingSessionRow> {
        const transaction = new sql.Transaction(this.pool);
        await transaction.begin();

        try {
            // 1. Insert session row
            const sessionResult = await transaction
                .request()
                .input('id',               sql.UniqueIdentifier, sessionData.id)
                .input('organizationId',   sql.UniqueIdentifier, sessionData.organizationId)
                .input('deviceKitId',      sql.UniqueIdentifier, sessionData.deviceKitId)
                .input('hubDeviceId',      sql.UniqueIdentifier, sessionData.hubDeviceId ?? null)
                .input('startedByUserId',  sql.UniqueIdentifier, sessionData.startedByUserId ?? null)
                .input('assignedToUserId', sql.UniqueIdentifier, sessionData.assignedToUserId ?? null)
                .input('teamId',           sql.UniqueIdentifier, sessionData.teamId ?? null)
                .input('origin',           sql.NVarChar(20),     sessionData.origin)
                .input('clientSessionId',  sql.NVarChar(100),    sessionData.clientSessionId)
                .input('status',           sql.NVarChar(20),     sessionData.status)
                .input('endMode',          sql.NVarChar(20),     sessionData.endMode)
                .input('presetId',         sql.UniqueIdentifier, sessionData.presetId ?? null)
                .input('trainingMode',     sql.NVarChar(50),     sessionData.trainingMode)
                .input('configJson',       sql.NVarChar(sql.MAX), sessionData.configJson)
                .input('sessionStartedAt', sql.DateTime2,        sessionData.sessionStartedAt)
                .input('sessionEndedAt',   sql.DateTime2,        sessionData.sessionEndedAt)
                .input('durationMs',       sql.BigInt,           sessionData.durationMs)
                .input('score',            sql.Int,              sessionData.score ?? null)
                .input('hitCount',         sql.Int,              sessionData.hitCount)
                .input('missCount',        sql.Int,              sessionData.missCount)
                .input('accuracyPercent',  sql.Decimal(5, 2),    sessionData.accuracyPercent ?? null)
                .input('avgReactionMs',    sql.Decimal(10, 2),   sessionData.avgReactionMs ?? null)
                .input('bestReactionMs',   sql.Decimal(10, 2),   sessionData.bestReactionMs ?? null)
                .input('worstReactionMs',  sql.Decimal(10, 2),   sessionData.worstReactionMs ?? null)
                .input('activePodCount',   sql.Int,              sessionData.activePodCount)
                .input('totalEventsCount', sql.Int,              sessionData.totalEventsCount)
                .input('notes',            sql.NVarChar(1000),   sessionData.notes ?? null)
                .query<TrainingSessionRow>(`
                    INSERT INTO app.training_sessions (
                        id, organization_id, device_kit_id, hub_device_id,
                        started_by_user_id, assigned_to_user_id, team_id,
                        origin, sync_status, client_session_id,
                        status, end_mode, preset_id, training_mode, config_json,
                        session_started_at, session_ended_at, duration_ms,
                        score, hit_count, miss_count, accuracy_percent,
                        avg_reaction_ms, best_reaction_ms, worst_reaction_ms,
                        active_pod_count, total_events_count, notes
                    )
                    OUTPUT
                        INSERTED.id, INSERTED.organization_id, INSERTED.device_kit_id, INSERTED.hub_device_id,
                        INSERTED.started_by_user_id, INSERTED.assigned_to_user_id, INSERTED.assigned_by_user_id, INSERTED.team_id,
                        INSERTED.origin, INSERTED.sync_status, INSERTED.client_session_id,
                        INSERTED.status, INSERTED.end_mode, INSERTED.preset_id, INSERTED.training_mode, INSERTED.config_json,
                        INSERTED.session_started_at, INSERTED.session_ended_at, INSERTED.duration_ms,
                        INSERTED.score, INSERTED.hit_count, INSERTED.miss_count, INSERTED.accuracy_percent,
                        INSERTED.avg_reaction_ms, INSERTED.best_reaction_ms, INSERTED.worst_reaction_ms,
                        INSERTED.active_pod_count, INSERTED.total_events_count, INSERTED.notes,
                        INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                    VALUES (
                        @id, @organizationId, @deviceKitId, @hubDeviceId,
                        @startedByUserId, @assignedToUserId, @teamId,
                        @origin, N'SYNCED', @clientSessionId,
                        @status, @endMode, @presetId, @trainingMode, @configJson,
                        @sessionStartedAt, @sessionEndedAt, @durationMs,
                        @score, @hitCount, @missCount, @accuracyPercent,
                        @avgReactionMs, @bestReactionMs, @worstReactionMs,
                        @activePodCount, @totalEventsCount, @notes
                    )
                `);

            const session = sessionResult.recordset[0];

            // 2. Insert active pods
            for (const pod of pods) {
                await transaction
                    .request()
                    .input('trainingSessionId', sql.UniqueIdentifier, pod.trainingSessionId)
                    .input('podDeviceId',       sql.UniqueIdentifier, pod.podDeviceId)
                    .input('podOrder',          sql.Int,              pod.podOrder ?? null)
                    .query(`
                        INSERT INTO app.training_session_active_pods
                            (training_session_id, pod_device_id, pod_order)
                        VALUES (@trainingSessionId, @podDeviceId, @podOrder)
                    `);
            }

            // 3. Insert events
            for (const evt of events) {
                await transaction
                    .request()
                    .input('trainingSessionId', sql.UniqueIdentifier, evt.trainingSessionId)
                    .input('podDeviceId',       sql.UniqueIdentifier, evt.podDeviceId ?? null)
                    .input('eventIndex',        sql.Int,              evt.eventIndex)
                    .input('eventType',         sql.NVarChar(50),     evt.eventType)
                    .input('eventTimestamp',    sql.DateTime2,        evt.eventTimestamp)
                    .input('elapsedMs',         sql.BigInt,           evt.elapsedMs ?? null)
                    .input('reactionTimeMs',    sql.Decimal(10, 2),   evt.reactionTimeMs ?? null)
                    .input('isCorrect',         sql.Bit,              evt.isCorrect ?? null)
                    .input('payloadJson',       sql.NVarChar(sql.MAX), evt.payloadJson ?? null)
                    .query(`
                        INSERT INTO app.training_session_events (
                            training_session_id, pod_device_id,
                            event_index, event_type, event_timestamp, elapsed_ms,
                            reaction_time_ms, is_correct, payload_json
                        )
                        VALUES (
                            @trainingSessionId, @podDeviceId,
                            @eventIndex, @eventType, @eventTimestamp, @elapsedMs,
                            @reactionTimeMs, @isCorrect, @payloadJson
                        )
                    `);
            }

            await transaction.commit();
            return session;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    // ── Find Single Session ───────────────────────────────────────────────────

    /**
     * Finds a non-deleted session by ID.
     */
    async findById(id: string): Promise<TrainingSessionRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query<TrainingSessionRow>(`
                SELECT
                    id, organization_id, device_kit_id, hub_device_id,
                    started_by_user_id, assigned_to_user_id, assigned_by_user_id, team_id,
                    origin, sync_status, client_session_id,
                    status, end_mode, preset_id, training_mode, config_json,
                    session_started_at, session_ended_at, duration_ms,
                    score, hit_count, miss_count, accuracy_percent,
                    avg_reaction_ms, best_reaction_ms, worst_reaction_ms,
                    active_pod_count, total_events_count, notes,
                    created_at, updated_at, deleted_at
                FROM app.training_sessions
                WHERE id = @id
                  AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    // ── List Sessions ─────────────────────────────────────────────────────────

    /**
a     * Visibility-aware session list.
     *
     * elevated=true  (org admin / trainer with session.start or session.assign):
     *   → all non-deleted sessions in the org, optional filter by assignee/team
     *
     * elevated=false (athlete / viewer):
     *   → only sessions where:
     *       - assigned_to_user_id = actorUserId   (assigned to me)
     *       - started_by_user_id  = actorUserId   (started by me)
     *       - assigned_to_user_id is in viewer_access_scopes for this actor/org
     *
     * isSuperAdmin=true:
     *   → all non-deleted sessions, optional org / assignee / team filters
     *
     * Always paginates: OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
     */
    async findSessions(opts: {
        organizationId?: string;
        actorUserId?: string;
        elevated?: boolean;
        isSuperAdmin?: boolean;
        assignedToUserId?: string;
        teamId?: string;
        limit: number;
        offset: number;
    }): Promise<TrainingSessionRow[]> {
        const req = this.pool.request();
        req.input('limit',  sql.Int, opts.limit);
        req.input('offset', sql.Int, opts.offset);

        const baseCols = `
            ts.id, ts.organization_id, ts.device_kit_id, ts.hub_device_id,
            ts.started_by_user_id, ts.assigned_to_user_id, ts.assigned_by_user_id, ts.team_id,
            ts.origin, ts.sync_status, ts.client_session_id,
            ts.status, ts.end_mode, ts.preset_id, ts.training_mode, ts.config_json,
            ts.session_started_at, ts.session_ended_at, ts.duration_ms,
            ts.score, ts.hit_count, ts.miss_count, ts.accuracy_percent,
            ts.avg_reaction_ms, ts.best_reaction_ms, ts.worst_reaction_ms,
            ts.active_pod_count, ts.total_events_count, ts.notes,
            ts.created_at, ts.updated_at, ts.deleted_at
        `;
        const pagination = `ORDER BY ts.session_started_at DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

        const conditions: string[] = ['ts.deleted_at IS NULL'];

        if (opts.organizationId) {
            req.input('organizationId', sql.UniqueIdentifier, opts.organizationId);
            conditions.push('ts.organization_id = @organizationId');
        }
        if (opts.assignedToUserId) {
            req.input('assignedToUserId', sql.UniqueIdentifier, opts.assignedToUserId);
            conditions.push('ts.assigned_to_user_id = @assignedToUserId');
        }
        if (opts.teamId) {
            req.input('teamId', sql.UniqueIdentifier, opts.teamId);
            conditions.push('ts.team_id = @teamId');
        }

        let visibilityClause = '';

        if (!opts.isSuperAdmin && !opts.elevated) {
            // Athlete / Viewer: restrict to own or viewer-scoped sessions
            req.input('actorUserId', sql.UniqueIdentifier, opts.actorUserId!);
            req.input('actorOrgId',  sql.UniqueIdentifier, opts.organizationId!);
            visibilityClause = `
                AND (
                    ts.assigned_to_user_id = @actorUserId
                    OR ts.started_by_user_id = @actorUserId
                    OR ts.assigned_to_user_id IN (
                        SELECT vas.target_user_id
                        FROM app.viewer_access_scopes vas
                        WHERE vas.organization_id = @actorOrgId
                          AND vas.viewer_user_id  = @actorUserId
                    )
                )
            `;
        }

        const where = conditions.join(' AND ');
        const query = `
            SELECT ${baseCols}
            FROM app.training_sessions ts
            WHERE ${where}
            ${visibilityClause}
            ${pagination}
        `;

        const result = await req.query<TrainingSessionRow>(query);
        return result.recordset;
    }

    /**
     * Returns the total count of sessions matching the same filters and visibility
     * as findSessions(), without pagination.  Run in parallel with findSessions().
     */
    async countSessions(opts: {
        organizationId?: string;
        actorUserId?: string;
        elevated?: boolean;
        isSuperAdmin?: boolean;
        assignedToUserId?: string;
        teamId?: string;
    }): Promise<number> {
        const req = this.pool.request();

        const conditions: string[] = ['ts.deleted_at IS NULL'];

        if (opts.organizationId) {
            req.input('organizationId', sql.UniqueIdentifier, opts.organizationId);
            conditions.push('ts.organization_id = @organizationId');
        }
        if (opts.assignedToUserId) {
            req.input('assignedToUserId', sql.UniqueIdentifier, opts.assignedToUserId);
            conditions.push('ts.assigned_to_user_id = @assignedToUserId');
        }
        if (opts.teamId) {
            req.input('teamId', sql.UniqueIdentifier, opts.teamId);
            conditions.push('ts.team_id = @teamId');
        }

        let visibilityClause = '';

        if (!opts.isSuperAdmin && !opts.elevated) {
            req.input('actorUserId', sql.UniqueIdentifier, opts.actorUserId!);
            req.input('actorOrgId',  sql.UniqueIdentifier, opts.organizationId!);
            visibilityClause = `
                AND (
                    ts.assigned_to_user_id = @actorUserId
                    OR ts.started_by_user_id = @actorUserId
                    OR ts.assigned_to_user_id IN (
                        SELECT vas.target_user_id
                        FROM app.viewer_access_scopes vas
                        WHERE vas.organization_id = @actorOrgId
                          AND vas.viewer_user_id  = @actorUserId
                    )
                )
            `;
        }

        const where = conditions.join(' AND ');
        const result = await req.query<{ total: number }>(`
            SELECT COUNT(1) AS total
            FROM app.training_sessions ts
            WHERE ${where}
            ${visibilityClause}
        `);

        return result.recordset[0]?.total ?? 0;
    }

    // ── Sub-resources ─────────────────────────────────────────────────────────

    async findActivePodsBySessionId(
        sessionId: string
    ): Promise<TrainingSessionActivePodRow[]> {
        const result = await this.pool
            .request()
            .input('sessionId', sql.UniqueIdentifier, sessionId)
            .query<TrainingSessionActivePodRow>(`
                SELECT id, training_session_id, pod_device_id, pod_order
                FROM app.training_session_active_pods
                WHERE training_session_id = @sessionId
                ORDER BY pod_order ASC, id ASC
            `);
        return result.recordset;
    }

    async findEventsBySessionId(
        sessionId: string
    ): Promise<TrainingSessionEventRow[]> {
        const result = await this.pool
            .request()
            .input('sessionId', sql.UniqueIdentifier, sessionId)
            .query<TrainingSessionEventRow>(`
                SELECT
                    id, training_session_id, pod_device_id,
                    event_index, event_type, event_timestamp, elapsed_ms,
                    reaction_time_ms, is_correct, payload_json, created_at
                FROM app.training_session_events
                WHERE training_session_id = @sessionId
                ORDER BY event_index ASC
            `);
        return result.recordset;
    }

    // ── Assign ────────────────────────────────────────────────────────────────

    async updateAssignment(
        id: string,
        data: UpdateAssignmentData
    ): Promise<TrainingSessionRow> {
        const result = await this.pool
            .request()
            .input('id',               sql.UniqueIdentifier, id)
            .input('assignedToUserId', sql.UniqueIdentifier, data.assignedToUserId ?? null)
            .input('teamId',           sql.UniqueIdentifier, data.teamId ?? null)
            .input('assignedByUserId', sql.UniqueIdentifier, data.assignedByUserId)
            .query<TrainingSessionRow>(`
                UPDATE app.training_sessions
                SET
                    assigned_to_user_id = @assignedToUserId,
                    team_id             = @teamId,
                    assigned_by_user_id = @assignedByUserId,
                    updated_at          = SYSUTCDATETIME()
                OUTPUT
                    INSERTED.id, INSERTED.organization_id, INSERTED.device_kit_id, INSERTED.hub_device_id,
                    INSERTED.started_by_user_id, INSERTED.assigned_to_user_id, INSERTED.assigned_by_user_id, INSERTED.team_id,
                    INSERTED.origin, INSERTED.sync_status, INSERTED.client_session_id,
                    INSERTED.status, INSERTED.end_mode, INSERTED.preset_id, INSERTED.training_mode, INSERTED.config_json,
                    INSERTED.session_started_at, INSERTED.session_ended_at, INSERTED.duration_ms,
                    INSERTED.score, INSERTED.hit_count, INSERTED.miss_count, INSERTED.accuracy_percent,
                    INSERTED.avg_reaction_ms, INSERTED.best_reaction_ms, INSERTED.worst_reaction_ms,
                    INSERTED.active_pod_count, INSERTED.total_events_count, INSERTED.notes,
                    INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                WHERE id = @id
                  AND deleted_at IS NULL
            `);
        return result.recordset[0];
    }

    // ── Soft Delete + Audit ───────────────────────────────────────────────────

    /**
     * Soft-deletes a session and writes an audit log entry in a single transaction.
     */
    async softDelete(
        id: string,
        actorUserId: string,
        organizationId: string
    ): Promise<void> {
        const transaction = new sql.Transaction(this.pool);
        await transaction.begin();

        try {
            await transaction
                .request()
                .input('id', sql.UniqueIdentifier, id)
                .query(`
                    UPDATE app.training_sessions
                    SET deleted_at = SYSUTCDATETIME(),
                        updated_at = SYSUTCDATETIME()
                    WHERE id = @id
                      AND deleted_at IS NULL
                `);

            await transaction
                .request()
                .input('actorUserId',    sql.UniqueIdentifier, actorUserId)
                .input('organizationId', sql.UniqueIdentifier, organizationId)
                .input('entityId',       sql.UniqueIdentifier, id)
                .input('detailsJson',    sql.NVarChar(sql.MAX), JSON.stringify({ sessionId: id }))
                .query(`
                    INSERT INTO app.audit_logs
                        (actor_user_id, organization_id, entity_type, entity_id, action, details_json)
                    VALUES
                        (@actorUserId, @organizationId, N'training_session', @entityId, N'session.delete', @detailsJson)
                `);

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    // ── Cross-org Validation Helpers ──────────────────────────────────────────

    /**
     * Returns true if the given hub belongs to the specified device kit.
     */
    async hubBelongsToKit(hubDeviceId: string, deviceKitId: string): Promise<boolean> {
        const result = await this.pool
            .request()
            .input('hubDeviceId', sql.UniqueIdentifier, hubDeviceId)
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query<{ n: number }>(`
                SELECT COUNT(1) AS n
                FROM app.hub_devices
                WHERE id = @hubDeviceId
                  AND device_kit_id = @deviceKitId
            `);
        return (result.recordset[0]?.n ?? 0) > 0;
    }

    /**
     * Returns true if the given pod is currently assigned to the specified kit.
     */
    async podBelongsToKit(podDeviceId: string, deviceKitId: string): Promise<boolean> {
        const result = await this.pool
            .request()
            .input('podDeviceId', sql.UniqueIdentifier, podDeviceId)
            .input('deviceKitId', sql.UniqueIdentifier, deviceKitId)
            .query<{ n: number }>(`
                SELECT COUNT(1) AS n
                FROM app.pod_devices
                WHERE id = @podDeviceId
                  AND current_device_kit_id = @deviceKitId
            `);
        return (result.recordset[0]?.n ?? 0) > 0;
    }

    /**
     * Returns true if the team belongs to the specified organization and is not deleted.
     */
    async teamBelongsToOrg(teamId: string, organizationId: string): Promise<boolean> {
        const result = await this.pool
            .request()
            .input('teamId',         sql.UniqueIdentifier, teamId)
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .query<{ n: number }>(`
                SELECT COUNT(1) AS n
                FROM app.teams
                WHERE id = @teamId
                  AND organization_id = @organizationId
                  AND deleted_at IS NULL
            `);
        return (result.recordset[0]?.n ?? 0) > 0;
    }

    /**
     * Returns true if the user is an active member of the specified organization.
     */
    async userIsActiveMember(userId: string, organizationId: string): Promise<boolean> {
        const result = await this.pool
            .request()
            .input('userId',         sql.UniqueIdentifier, userId)
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .query<{ n: number }>(`
                SELECT COUNT(1) AS n
                FROM app.organization_memberships
                WHERE user_id        = @userId
                  AND organization_id = @organizationId
                  AND status          = N'ACTIVE'
                  AND left_at         IS NULL
            `);
        return (result.recordset[0]?.n ?? 0) > 0;
    }

    /**
     * Returns true if viewerUserId has an explicit viewer_access_scope grant
     * for targetUserId within the organization.
     */
    async viewerHasScope(
        organizationId: string,
        viewerUserId: string,
        targetUserId: string
    ): Promise<boolean> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .input('viewerUserId',   sql.UniqueIdentifier, viewerUserId)
            .input('targetUserId',   sql.UniqueIdentifier, targetUserId)
            .query<{ n: number }>(`
                SELECT COUNT(1) AS n
                FROM app.viewer_access_scopes
                WHERE organization_id = @organizationId
                  AND viewer_user_id  = @viewerUserId
                  AND target_user_id  = @targetUserId
            `);
        return (result.recordset[0]?.n ?? 0) > 0;
    }
}

