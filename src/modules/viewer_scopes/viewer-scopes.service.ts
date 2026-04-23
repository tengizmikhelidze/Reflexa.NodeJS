import { randomUUID } from 'crypto';
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/http-errors.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { ViewerScopesRepository } from './viewer-scopes.repository.js';
import { mapViewerScope } from './viewer-scopes.mapper.js';
import {
    CreateViewerScopeInput,
    ListViewerScopesFilters,
    ViewerScopeSummary,
    ViewerScopeRow,
} from './viewer-scopes.types.js';

export class ViewerScopesService {
    constructor(
        private readonly scopesRepo: ViewerScopesRepository,
        private readonly orgsRepo:   OrganizationsRepository
    ) {}

    // ── Grant Viewer Scope ────────────────────────────────────────────────────

    async grantScope(input: CreateViewerScopeInput, actor: AuthUser): Promise<ViewerScopeSummary> {
        await this.requireOrgPermission(input.organizationId, actor, 'viewer.scope.manage');

        // Target user must be an active org member
        const targetMembership = await this.orgsRepo.findMembership(input.organizationId, input.targetUserId);
        if (!targetMembership || targetMembership.status !== 'ACTIVE' || targetMembership.left_at !== null) {
            throw new NotFoundError('Target user is not an active member of this organization.');
        }

        // Viewer user must be an active org member
        const viewerMembership = await this.orgsRepo.findMembership(input.organizationId, input.viewerUserId);
        if (!viewerMembership || viewerMembership.status !== 'ACTIVE' || viewerMembership.left_at !== null) {
            throw new NotFoundError('Viewer user is not an active member of this organization.');
        }

        // Duplicate check — UQ(org, viewer, target) in DB
        const existing = await this.scopesRepo.findDuplicate(
            input.organizationId,
            input.viewerUserId,
            input.targetUserId
        );
        if (existing) {
            throw new ConflictError('This viewer already has access to the specified target user.');
        }

        const row = await this.scopesRepo.create({
            id:              randomUUID(),
            organizationId:  input.organizationId,
            viewerUserId:    input.viewerUserId,
            targetUserId:    input.targetUserId,
            grantedByUserId: actor.userId,
        });

        return mapViewerScope(row);
    }

    // ── List Viewer Scopes ─────────────────────────────────────────────────────

    /**
     * Regular user: must supply organizationId and must have viewer.scope.manage.
     * Super admin: may omit organizationId to see all scopes.
     */
    async listScopes(filters: ListViewerScopesFilters, actor: AuthUser): Promise<ViewerScopeSummary[]> {
        if (!actor.isSuperAdmin) {
            if (!filters.organizationId) {
                throw new ForbiddenError('organizationId is required when listing viewer scopes.');
            }
            await this.requireOrgPermission(filters.organizationId, actor, 'viewer.scope.manage');
        }

        const rows = await this.scopesRepo.findMany({
            organizationId: filters.organizationId,
            viewerUserId:   filters.viewerUserId,
        });

        return rows.map(mapViewerScope);
    }

    // ── Revoke Viewer Scope ────────────────────────────────────────────────────

    /**
     * Idempotent — if the scope is already gone, silently succeeds.
     */
    async revokeScope(scopeId: string, actor: AuthUser): Promise<void> {
        const row = await this.scopesRepo.findById(scopeId);
        if (!row) return; // already revoked or never existed — idempotent

        await this.requireOrgPermission(row.organization_id, actor, 'viewer.scope.manage');
        await this.scopesRepo.delete(scopeId);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async requireOrgPermission(
        organizationId: string,
        actor: AuthUser,
        code: string
    ): Promise<void> {
        if (actor.isSuperAdmin) return;

        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('You are not an active member of this organization.');
        }

        const permissions = await this.orgsRepo.findEffectivePermissions(organizationId, actor.userId);
        if (!permissions.includes(code)) {
            throw new ForbiddenError(`You do not have the required permission: ${code}`);
        }
    }
}

