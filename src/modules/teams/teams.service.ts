import { randomUUID } from 'crypto';
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/http-errors.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { TeamsRepository } from './teams.repository.js';
import { mapTeamSummary, mapTeamDetail } from './teams.mapper.js';
import {
    CreateTeamInput,
    AddTeamMemberInput,
    ListTeamsFilters,
    TeamSummary,
    TeamDetail,
    TeamMemberSummary,
    TeamRow,
} from './teams.types.js';

export class TeamsService {
    constructor(
        private readonly teamsRepo: TeamsRepository,
        private readonly orgsRepo:  OrganizationsRepository
    ) {}

    // ── Create Team ───────────────────────────────────────────────────────────

    async createTeam(input: CreateTeamInput, actor: AuthUser): Promise<TeamDetail> {
        await this.requireOrgPermission(input.organizationId, actor, 'teams.manage');

        // Org name uniqueness (soft-deleted teams don't count)
        const existing = await this.teamsRepo.findByOrgAndName(input.organizationId, input.name);
        if (existing) {
            throw new ConflictError(`A team named "${input.name}" already exists in this organization.`);
        }

        const row = await this.teamsRepo.create({
            id:             randomUUID(),
            organizationId: input.organizationId,
            name:           input.name,
            description:    input.description,
        });

        return mapTeamDetail(row, 0);
    }

    // ── List Teams ─────────────────────────────────────────────────────────────

    async listTeams(filters: ListTeamsFilters, actor: AuthUser): Promise<TeamSummary[]> {
        if (filters.organizationId && !actor.isSuperAdmin) {
            await this.requireActiveMember(filters.organizationId, actor);
        }

        const rows = await this.teamsRepo.findMany({
            organizationId: filters.organizationId,
            actorUserId:    actor.userId,
            isSuperAdmin:   actor.isSuperAdmin,
        });

        return rows.map(mapTeamSummary);
    }

    // ── Team Detail ───────────────────────────────────────────────────────────

    async getTeamDetail(teamId: string, actor: AuthUser): Promise<TeamDetail> {
        const row = await this.requireTeamExists(teamId);
        await this.requireActiveMember(row.organization_id, actor);

        const memberCount = await this.teamsRepo.countMembers(teamId);
        return mapTeamDetail(row, memberCount);
    }

    // ── Add Team Member ────────────────────────────────────────────────────────

    async addTeamMember(
        teamId: string,
        input: AddTeamMemberInput,
        actor: AuthUser
    ): Promise<TeamMemberSummary[]> {
        const team = await this.requireTeamExists(teamId);
        await this.requireOrgPermission(team.organization_id, actor, 'teams.manage');

        // Target user must be an active org member
        const orgMembership = await this.orgsRepo.findMembership(team.organization_id, input.userId);
        if (!orgMembership || orgMembership.status !== 'ACTIVE' || orgMembership.left_at !== null) {
            throw new NotFoundError('The user is not an active member of this organization.');
        }

        // Duplicate check
        const existing = await this.teamsRepo.findMembership(teamId, input.userId);
        if (existing) {
            throw new ConflictError('This user is already a member of the team.');
        }

        await this.teamsRepo.addMember(randomUUID(), teamId, input.userId);
        return this.teamsRepo.findMembers(teamId);
    }

    // ── List Team Members ──────────────────────────────────────────────────────

    async listTeamMembers(teamId: string, actor: AuthUser): Promise<TeamMemberSummary[]> {
        const team = await this.requireTeamExists(teamId);
        await this.requireActiveMember(team.organization_id, actor);
        return this.teamsRepo.findMembers(teamId);
    }

    // ── Remove Team Member ─────────────────────────────────────────────────────

    /**
     * Idempotent — removing a user who isn't a team member succeeds silently.
     */
    async removeTeamMember(teamId: string, userId: string, actor: AuthUser): Promise<void> {
        const team = await this.requireTeamExists(teamId);
        await this.requireOrgPermission(team.organization_id, actor, 'teams.manage');
        await this.teamsRepo.removeMember(teamId, userId);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async requireTeamExists(teamId: string): Promise<TeamRow> {
        const row = await this.teamsRepo.findById(teamId);
        if (!row) throw new NotFoundError('Team not found.');
        return row;
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

