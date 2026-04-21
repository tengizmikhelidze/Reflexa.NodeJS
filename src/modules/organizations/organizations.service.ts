import { UsersRepository } from '../users/users.repository.js';
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/http-errors.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { mapOrganization, mapMembership } from './organizations.mapper.js';
import {
    CreateOrganizationInput,
    AddMemberInput,
    AssignRolesInput,
    OrganizationSummary,
    MemberWithRoles,
    MyOrgAccessProfile,
    EffectivePermissionsResponse,
} from './organizations.types.js';

export class OrganizationsService {
    constructor(
        private readonly orgsRepo: OrganizationsRepository,
        private readonly usersRepo: UsersRepository
    ) {}

    // ── Create Organization ───────────────────────────────────────────────────

    /**
     * Creates organization, creates membership for the creator, assigns ORG_ADMIN.
     */
    async createOrganization(
        input: CreateOrganizationInput,
        actor: AuthUser
    ): Promise<OrganizationSummary> {
        // Reject duplicate slug
        const existing = await this.orgsRepo.findBySlug(input.slug);
        if (existing) {
            throw new ConflictError(`An organization with slug "${input.slug}" already exists.`);
        }

        // Resolve ORG_ADMIN role ID before starting any writes
        const [orgAdminRole] = await this.orgsRepo.findRolesByCodes(['ORG_ADMIN']);
        if (!orgAdminRole) {
            // ORG_ADMIN role must exist — it is seeded in 10.seed_essential_roles_and_perms.sql
            throw new Error(
                'ORG_ADMIN role is not seeded in the database. Run the seed script and retry.'
            );
        }

        // All three writes (org + membership + role) run inside a single DB transaction.
        // A crash at any point rolls back the entire operation — no orphaned data.
        const org = await this.orgsRepo.createOrganizationWithAdmin(
            { name: input.name, slug: input.slug, description: input.description },
            actor.userId,
            orgAdminRole.id
        );

        return mapOrganization(org);
    }

    // ── List Organizations ────────────────────────────────────────────────────

    async listOrganizations(actor: AuthUser): Promise<OrganizationSummary[]> {
        const orgs = actor.isSuperAdmin
            ? await this.orgsRepo.findAll()
            : await this.orgsRepo.findByUserId(actor.userId);

        return orgs.map(mapOrganization);
    }

    // ── My Access Profile ─────────────────────────────────────────────────────

    async getMyAccessProfile(
        organizationId: string,
        actor: AuthUser
    ): Promise<MyOrgAccessProfile> {
        const org = await this.requireActiveOrg(organizationId);
        const membership = await this.requireActiveMembership(organizationId, actor);

        const roleCodes = await this.orgsRepo.findRoleCodesByMembershipId(membership.id);
        const permissions = await this.orgsRepo.findEffectivePermissions(
            organizationId,
            actor.userId
        );

        return {
            organization: mapOrganization(org),
            membership: mapMembership(membership, roleCodes),
            effectivePermissions: permissions,
        };
    }

    // ── Add Member ────────────────────────────────────────────────────────────

    async addMember(
        organizationId: string,
        input: AddMemberInput,
        actor: AuthUser
    ): Promise<MemberWithRoles> {
        await this.requireActiveOrg(organizationId);
        await this.requirePermission(organizationId, actor, 'users.manage');

        // Find the target user by email
        const targetUser = await this.usersRepo.findByEmail(input.email);
        if (!targetUser) {
            throw new NotFoundError(`No user found with email "${input.email}".`);
        }

        // Reject inactive or unverified users — they cannot meaningfully use a membership
        if (!targetUser.is_active) {
            throw new ForbiddenError('This user account is deactivated and cannot be added.');
        }
        if (!targetUser.email_verified) {
            throw new ForbiddenError('This user has not verified their email address yet.');
        }

        // Check for existing membership — any status (DB unique constraint covers this too)
        const existing = await this.orgsRepo.findMembership(organizationId, targetUser.id);
        if (existing) {
            const statusLabel = existing.status !== 'ACTIVE' || existing.left_at !== null
                ? 'an inactive'
                : 'an active';
            throw new ConflictError(
                `User already has ${statusLabel} membership in this organization.`
            );
        }

        const membership = await this.orgsRepo.createMembership({
            organizationId,
            userId: targetUser.id,
            status: 'ACTIVE',
        });

        // Assign initial roles if provided
        let roleIds: string[] = [];
        if (input.roleCodes && input.roleCodes.length > 0) {
            const roles = await this.orgsRepo.findRolesByCodes(input.roleCodes);
            const foundCodes = roles.map(r => r.code);
            const unknown = input.roleCodes.filter(c => !foundCodes.includes(c));
            if (unknown.length > 0) {
                throw new NotFoundError(`Unknown role codes: ${unknown.join(', ')}`);
            }
            roleIds = roles.map(r => r.id);
            await this.orgsRepo.setMembershipRoles(membership.id, roleIds);
        }

        return {
            membershipId: membership.id,
            userId: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.first_name,
            lastName: targetUser.last_name,
            displayName: targetUser.display_name,
            status: membership.status,
            joinedAt: membership.joined_at,
            roles: input.roleCodes ?? [],
        };
    }

    // ── List Members ──────────────────────────────────────────────────────────

    async listMembers(
        organizationId: string,
        actor: AuthUser
    ): Promise<MemberWithRoles[]> {
        await this.requireActiveOrg(organizationId);
        await this.requirePermission(organizationId, actor, 'users.manage');
        return this.orgsRepo.findActiveMembers(organizationId);
    }

    // ── Assign Roles ──────────────────────────────────────────────────────────

    async assignRoles(
        organizationId: string,
        membershipId: string,
        input: AssignRolesInput,
        actor: AuthUser
    ): Promise<string[]> {
        await this.requireActiveOrg(organizationId);
        await this.requirePermission(organizationId, actor, 'users.manage');

        const membership = await this.orgsRepo.findMembershipById(membershipId);
        if (!membership || membership.organization_id !== organizationId) {
            throw new NotFoundError('Membership not found in this organization.');
        }
        // Both status AND left_at must indicate active — either alone is not sufficient
        if (membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('Cannot assign roles to an inactive membership.');
        }

        const roles = await this.orgsRepo.findRolesByCodes(input.roleCodes);
        const foundCodes = roles.map(r => r.code);
        const unknown = input.roleCodes.filter(c => !foundCodes.includes(c));
        if (unknown.length > 0) {
            throw new NotFoundError(`Unknown role codes: ${unknown.join(', ')}`);
        }

        await this.orgsRepo.setMembershipRoles(membership.id, roles.map(r => r.id));
        return roles.map(r => r.code);
    }

    // ── Get Effective Permissions ─────────────────────────────────────────────

    async getEffectivePermissions(
        organizationId: string,
        membershipId: string,
        actor: AuthUser
    ): Promise<EffectivePermissionsResponse> {
        await this.requireActiveOrg(organizationId);

        const membership = await this.orgsRepo.findMembershipById(membershipId);
        if (!membership || membership.organization_id !== organizationId) {
            throw new NotFoundError('Membership not found in this organization.');
        }

        // Allow self-access OR users.manage permission OR super admin
        const isSelf = membership.user_id === actor.userId;
        if (!isSelf && !actor.isSuperAdmin) {
            await this.requirePermission(organizationId, actor, 'users.manage');
        }

        const permissions = await this.orgsRepo.findEffectivePermissions(
            organizationId,
            membership.user_id
        );

        return {
            membershipId: membership.id,
            userId: membership.user_id,
            organizationId,
            permissions,
        };
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private async requireActiveOrg(organizationId: string) {
        const org = await this.orgsRepo.findById(organizationId);
        if (!org || !org.is_active) {
            throw new NotFoundError('Organization not found.');
        }
        return org;
    }

    private async requireActiveMembership(organizationId: string, actor: AuthUser) {
        // Super admins bypass membership requirement
        if (actor.isSuperAdmin) {
            // Still try to find membership but don't require it
            const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
            if (membership && membership.status === 'ACTIVE' && !membership.left_at) {
                return membership;
            }
            // Super admin without membership — create a synthetic view (not allowed for write ops)
            throw new ForbiddenError(
                'Super admins must have an active membership to view their own access profile.'
            );
        }

        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('You are not an active member of this organization.');
        }
        return membership;
    }

    /**
     * Checks that the actor has a specific permission in the organization.
     * Super admins bypass all organization-level permission checks.
     */
    async requirePermission(
        organizationId: string,
        actor: AuthUser,
        permissionCode: string
    ): Promise<void> {
        if (actor.isSuperAdmin) return;

        const membership = await this.orgsRepo.findMembership(organizationId, actor.userId);
        if (!membership || membership.status !== 'ACTIVE' || membership.left_at !== null) {
            throw new ForbiddenError('You are not an active member of this organization.');
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
}

