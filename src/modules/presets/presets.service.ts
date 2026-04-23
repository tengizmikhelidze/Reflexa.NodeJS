import { randomUUID } from 'crypto';
import {
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/http-errors.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { PresetsRepository } from './presets.repository.js';
import { mapPresetSummary, mapPresetDetail } from './presets.mapper.js';
import {
    CreatePresetInput,
    UpdatePresetInput,
    ListPresetsFilters,
    PresetSummary,
    PresetDetail,
    PresetRow,
} from './presets.types.js';

export class PresetsService {
    constructor(
        private readonly presetsRepo: PresetsRepository,
        private readonly orgsRepo:    OrganizationsRepository
    ) {}

    // ── Create Preset ─────────────────────────────────────────────────────────

    async createPreset(input: CreatePresetInput, actor: AuthUser): Promise<PresetDetail> {
        if (input.scope === 'ORGANIZATION') {
            if (!input.organizationId) {
                throw new ForbiddenError('organizationId is required for ORGANIZATION scoped presets.');
            }
            await this.requireOrgPermission(input.organizationId, actor, 'presets.manage');
        }

        const row = await this.presetsRepo.create({
            id:              randomUUID(),
            organizationId:  input.scope === 'ORGANIZATION' ? (input.organizationId ?? null) : null,
            createdByUserId: actor.userId,
            scope:           input.scope,
            name:            input.name,
            description:     input.description,
            configJson:      JSON.stringify(input.configJson),
        });

        return mapPresetDetail(row);
    }

    // ── List Presets ──────────────────────────────────────────────────────────

    async listPresets(filters: ListPresetsFilters, actor: AuthUser): Promise<PresetSummary[]> {
        // If filtering by org, require active membership first
        if (filters.organizationId && !actor.isSuperAdmin) {
            await this.requireActiveMember(filters.organizationId, actor);
        }

        const rows = await this.presetsRepo.findMany({
            scope:           filters.scope,
            organizationId:  filters.organizationId,
            createdByUserId: filters.createdByUserId,
            actorUserId:     actor.userId,
            isSuperAdmin:    actor.isSuperAdmin,
        });

        return rows.map(mapPresetSummary);
    }

    // ── Get Preset Detail ─────────────────────────────────────────────────────

    async getPresetDetail(presetId: string, actor: AuthUser): Promise<PresetDetail> {
        const row = await this.requirePresetExists(presetId);
        await this.assertCanRead(row, actor);
        return mapPresetDetail(row);
    }

    // ── Update Preset ─────────────────────────────────────────────────────────

    async updatePreset(presetId: string, input: UpdatePresetInput, actor: AuthUser): Promise<PresetDetail> {
        const row = await this.requirePresetExists(presetId);
        await this.assertCanWrite(row, actor);

        const updated = await this.presetsRepo.update(presetId, {
            name:        input.name,
            description: input.description,
            configJson:  input.configJson !== undefined ? JSON.stringify(input.configJson) : undefined,
        });

        if (!updated) throw new NotFoundError('Preset not found after update.');
        return mapPresetDetail(updated);
    }

    // ── Delete Preset ─────────────────────────────────────────────────────────

    /**
     * Soft-delete. Idempotent — deleting an already-deleted preset silently succeeds.
     */
    async deletePreset(presetId: string, actor: AuthUser): Promise<void> {
        const row = await this.presetsRepo.findById(presetId);
        if (!row) return; // already deleted or never existed — idempotent

        await this.assertCanWrite(row, actor);
        await this.presetsRepo.softDelete(presetId);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async requirePresetExists(presetId: string): Promise<PresetRow> {
        const row = await this.presetsRepo.findById(presetId);
        if (!row) throw new NotFoundError('Preset not found.');
        return row;
    }

    /**
     * Read access:
     *   - Super admin: always
     *   - USER preset: only the owner
     *   - ORGANIZATION preset: any active member of the org
     */
    private async assertCanRead(row: PresetRow, actor: AuthUser): Promise<void> {
        if (actor.isSuperAdmin) return;

        if (row.scope === 'USER') {
            if (row.created_by_user_id !== actor.userId) {
                throw new ForbiddenError('You do not have access to this preset.');
            }
            return;
        }

        // ORGANIZATION scope
        await this.requireActiveMember(row.organization_id!, actor);
    }

    /**
     * Write access (update / delete):
     *   - Super admin: always
     *   - USER preset: only the owner
     *   - ORGANIZATION preset: requires presets.manage
     */
    private async assertCanWrite(row: PresetRow, actor: AuthUser): Promise<void> {
        if (actor.isSuperAdmin) return;

        if (row.scope === 'USER') {
            if (row.created_by_user_id !== actor.userId) {
                throw new ForbiddenError('You do not have permission to modify this preset.');
            }
            return;
        }

        // ORGANIZATION scope
        await this.requireOrgPermission(row.organization_id!, actor, 'presets.manage');
    }

    private async requireActiveMember(organizationId: string, actor: AuthUser): Promise<void> {
        if (actor.isSuperAdmin) return;
        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('You are not an active member of this organization.');
        }
    }

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

