import { randomUUID } from 'crypto';
import {
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/http-errors.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { SessionsRepository } from './sessions.repository.js';
import {
    mapSessionSummary,
    mapSessionDetail,
} from './sessions.mapper.js';
import {
    SyncSessionInput,
    ListSessionsFilters,
    AssignSessionInput,
    SessionSummary,
    SessionDetail,
    TrainingSessionRow,
} from './sessions.types.js';

export class SessionsService {
    constructor(
        private readonly sessionsRepo: SessionsRepository,
        private readonly orgsRepo:     OrganizationsRepository
    ) {}

    // ── Sync Session ──────────────────────────────────────────────────────────

    /**
     * Accepts a completed offline session payload and persists it.
     *
     * Idempotency: if the same (organizationId, clientSessionId) already exists,
     * the existing record is returned with a 200 (not 201), so duplicate syncs
     * are safe and have no side effects.
     *
     * Cross-org validation:
     *   - hub (if provided) must belong to the specified kit
     *   - pods (if provided) must be currently assigned to that kit
     *   - assignedToUserId (if provided) must be an active org member
     *   - teamId (if provided) must belong to the same org
     */
    async syncSession(
        input: SyncSessionInput,
        actor: AuthUser
    ): Promise<{ session: SessionSummary; created: boolean }> {
        // Require active org membership to sync
        await this.requireActiveMember(input.organizationId, actor);

        // Idempotency check
        const existing = await this.sessionsRepo.findByClientSessionId(
            input.organizationId,
            input.clientSessionId
        );
        if (existing) {
            return { session: mapSessionSummary(existing), created: false };
        }

        // Cross-org: validate kit belongs to org
        const kit = await this.orgsRepo.findById(input.organizationId);
        if (!kit || !kit.is_active) {
            throw new NotFoundError('Organization not found or inactive.');
        }

        // Cross-org: validate hub belongs to kit (if provided)
        if (input.hubDeviceId) {
            const valid = await this.sessionsRepo.hubBelongsToKit(
                input.hubDeviceId,
                input.deviceKitId
            );
            if (!valid) {
                throw new NotFoundError(
                    'The specified hub does not belong to the specified device kit.'
                );
            }
        }

        // Cross-org: validate pods belong to kit (if provided)
        if (input.activePods && input.activePods.length > 0) {
            for (const pod of input.activePods) {
                const valid = await this.sessionsRepo.podBelongsToKit(
                    pod.podDeviceId,
                    input.deviceKitId
                );
                if (!valid) {
                    throw new NotFoundError(
                        `Pod ${pod.podDeviceId} does not belong to the specified device kit.`
                    );
                }
            }
        }

        // Cross-org: validate assignedToUserId is an active org member
        if (input.assignedToUserId) {
            const isMember = await this.sessionsRepo.userIsActiveMember(
                input.assignedToUserId,
                input.organizationId
            );
            if (!isMember) {
                throw new NotFoundError(
                    'The assigned user is not an active member of this organization.'
                );
            }
        }

        // Cross-org: validate teamId belongs to org
        if (input.teamId) {
            const valid = await this.sessionsRepo.teamBelongsToOrg(
                input.teamId,
                input.organizationId
            );
            if (!valid) {
                throw new NotFoundError(
                    'The specified team does not belong to this organization.'
                );
            }
        }

        const sessionId = randomUUID();

        const pods = (input.activePods ?? []).map(p => ({
            trainingSessionId: sessionId,
            podDeviceId: p.podDeviceId,
            podOrder: p.podOrder,
        }));

        const events = (input.events ?? []).map(e => ({
            trainingSessionId: sessionId,
            podDeviceId: e.podDeviceId,
            eventIndex: e.eventIndex,
            eventType: e.eventType,
            eventTimestamp: new Date(e.eventTimestamp),
            elapsedMs: e.elapsedMs,
            reactionTimeMs: e.reactionTimeMs,
            isCorrect: e.isCorrect,
            payloadJson: e.payloadJson ? JSON.stringify(e.payloadJson) : undefined,
        }));

        const row = await this.sessionsRepo.syncSession(
            {
                id:               sessionId,
                organizationId:   input.organizationId,
                deviceKitId:      input.deviceKitId,
                hubDeviceId:      input.hubDeviceId,
                startedByUserId:  input.startedByUserId,
                assignedToUserId: input.assignedToUserId,
                teamId:           input.teamId,
                origin:           input.origin,
                clientSessionId:  input.clientSessionId,
                status:           input.status,
                endMode:          input.endMode,
                presetId:         input.presetId,
                trainingMode:     input.trainingMode,
                configJson:       JSON.stringify(input.configJson),
                sessionStartedAt: new Date(input.sessionStartedAt),
                sessionEndedAt:   new Date(input.sessionEndedAt),
                durationMs:       input.durationMs,
                score:            input.score,
                hitCount:         input.hitCount,
                missCount:        input.missCount,
                accuracyPercent:  input.accuracyPercent,
                avgReactionMs:    input.avgReactionMs,
                bestReactionMs:   input.bestReactionMs,
                worstReactionMs:  input.worstReactionMs,
                activePodCount:   pods.length,
                totalEventsCount: events.length,
                notes:            input.notes,
            },
            pods,
            events
        );

        return { session: mapSessionSummary(row), created: true };
    }

    // ── List Sessions ─────────────────────────────────────────────────────────

    /**
     * Lists non-deleted sessions.
     *
     * Super admin: may filter by any org or see all.
     * Regular user: must provide organizationId and must be an active member.
     */
    async listSessions(
        filters: ListSessionsFilters,
        actor: AuthUser
    ): Promise<SessionSummary[]> {
        if (!actor.isSuperAdmin) {
            if (!filters.organizationId) {
                throw new ForbiddenError(
                    'organizationId is required when listing sessions.'
                );
            }
            await this.requireActiveMember(filters.organizationId, actor);
        }

        const rows = await this.sessionsRepo.findSessions(filters);
        return rows.map(mapSessionSummary);
    }

    // ── Get Session Detail ────────────────────────────────────────────────────

    /**
     * Returns full session detail including pods and events.
     * Enforces org-scoped visibility.
     */
    async getSessionDetail(
        sessionId: string,
        actor: AuthUser
    ): Promise<SessionDetail> {
        const row = await this.requireSessionExists(sessionId);
        await this.requireOrgAccess(row, actor);

        const [pods, events] = await Promise.all([
            this.sessionsRepo.findActivePodsBySessionId(sessionId),
            this.sessionsRepo.findEventsBySessionId(sessionId),
        ]);

        return mapSessionDetail(row, pods, events);
    }

    // ── Assign Session ────────────────────────────────────────────────────────

    /**
     * Updates assignment fields (assignedToUserId, teamId) for a session.
     * Requires session.assign permission on the session's organization.
     * Validates that new assignee/team belong to the same org.
     */
    async assignSession(
        sessionId: string,
        input: AssignSessionInput,
        actor: AuthUser
    ): Promise<SessionSummary> {
        const row = await this.requireSessionExists(sessionId);
        await this.requirePermission(row.organization_id, actor, 'session.assign');

        // Validate new assignedToUserId is an active org member
        if (input.assignedToUserId) {
            const isMember = await this.sessionsRepo.userIsActiveMember(
                input.assignedToUserId,
                row.organization_id
            );
            if (!isMember) {
                throw new NotFoundError(
                    'The assigned user is not an active member of this organization.'
                );
            }
        }

        // Validate teamId belongs to same org
        if (input.teamId) {
            const valid = await this.sessionsRepo.teamBelongsToOrg(
                input.teamId,
                row.organization_id
            );
            if (!valid) {
                throw new NotFoundError(
                    'The specified team does not belong to this organization.'
                );
            }
        }

        const updated = await this.sessionsRepo.updateAssignment(sessionId, {
            assignedToUserId: input.assignedToUserId,
            teamId:           input.teamId,
            assignedByUserId: actor.userId,
        });

        return mapSessionSummary(updated);
    }

    // ── Delete Session ────────────────────────────────────────────────────────

    /**
     * Soft-deletes a session and writes an audit log entry.
     * Requires session.delete permission on the session's organization.
     * Repeated deletes are idempotent (no error if already deleted).
     */
    async deleteSession(sessionId: string, actor: AuthUser): Promise<void> {
        // Note: findById only returns non-deleted sessions.
        // If already deleted we treat it as idempotent (not found → already gone → OK).
        const row = await this.sessionsRepo.findById(sessionId);
        if (!row) {
            // Already deleted or never existed — idempotent, no error needed.
            return;
        }

        await this.requirePermission(row.organization_id, actor, 'session.delete');
        await this.sessionsRepo.softDelete(sessionId, actor.userId, row.organization_id);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async requireSessionExists(sessionId: string): Promise<TrainingSessionRow> {
        const row = await this.sessionsRepo.findById(sessionId);
        if (!row) throw new NotFoundError('Session not found.');
        return row;
    }

    /**
     * Throws ForbiddenError if the actor is not an active member of the org.
     * Super admin bypasses.
     */
    private async requireActiveMember(
        organizationId: string,
        actor: AuthUser
    ): Promise<void> {
        if (actor.isSuperAdmin) return;

        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError(
                'You are not an active member of this organization.'
            );
        }
    }

    /**
     * Throws ForbiddenError if the actor doesn't have the given permission
     * on the session's organization.
     * Super admin bypasses.
     */
    private async requirePermission(
        organizationId: string,
        actor: AuthUser,
        permissionCode: string
    ): Promise<void> {
        if (actor.isSuperAdmin) return;

        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError(
                'You are not an active member of this organization.'
            );
        }

        const permissions = await this.orgsRepo.findEffectivePermissions(
            organizationId,
            actor.userId
        );

        if (!permissions.includes(permissionCode)) {
            throw new ForbiddenError(
                `You do not have the required permission: ${permissionCode}`
            );
        }
    }

    /**
     * Throws ForbiddenError if the actor does not have org access for the session.
     * Used for read operations (list / detail).
     * Super admin bypasses. Active members always pass.
     */
    private async requireOrgAccess(
        row: TrainingSessionRow,
        actor: AuthUser
    ): Promise<void> {
        if (actor.isSuperAdmin) return;

        const membership = await this.orgsRepo.findMembership(
            row.organization_id,
            actor.userId
        );
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('You do not have access to this session.');
        }
    }
}


