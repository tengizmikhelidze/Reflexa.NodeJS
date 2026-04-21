import sql from 'mssql';
import {
    OrganizationRow,
    MembershipRow,
    RoleRow,
    MemberWithRoles,
} from './organizations.types.js';

export interface CreateOrganizationData {
    name: string;
    slug: string;
    description?: string;
}

export interface CreateMembershipData {
    organizationId: string;
    userId: string;
    status?: string;  // defaults to ACTIVE
}

export class OrganizationsRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    // ── Organizations ─────────────────────────────────────────────────────────

    async create(data: CreateOrganizationData): Promise<OrganizationRow> {
        const result = await this.pool
            .request()
            .input('name', sql.NVarChar(200), data.name)
            .input('slug', sql.NVarChar(150), data.slug)
            .input('description', sql.NVarChar(1000), data.description ?? null)
            .query<OrganizationRow>(`
                INSERT INTO app.organizations (name, slug, description)
                OUTPUT
                    INSERTED.id, INSERTED.name, INSERTED.slug, INSERTED.description,
                    INSERTED.is_active, INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                VALUES (@name, @slug, @description)
            `);
        return result.recordset[0];
    }

    /**
     * Atomically creates an organization, the creator's membership, and assigns a role.
     * All three writes are wrapped in a single DB transaction to prevent orphaned data
     * if any step fails.
     */
    async createOrganizationWithAdmin(
        data: CreateOrganizationData,
        userId: string,
        orgAdminRoleId: string
    ): Promise<OrganizationRow> {
        const transaction = new sql.Transaction(this.pool);
        await transaction.begin();
        try {
            // 1. Create organization
            const orgResult = await transaction
                .request()
                .input('name', sql.NVarChar(200), data.name)
                .input('slug', sql.NVarChar(150), data.slug)
                .input('description', sql.NVarChar(1000), data.description ?? null)
                .query<OrganizationRow>(`
                    INSERT INTO app.organizations (name, slug, description)
                    OUTPUT
                        INSERTED.id, INSERTED.name, INSERTED.slug, INSERTED.description,
                        INSERTED.is_active, INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                    VALUES (@name, @slug, @description)
                `);
            const org = orgResult.recordset[0];

            // 2. Create creator's membership
            const membershipResult = await transaction
                .request()
                .input('organizationId', sql.UniqueIdentifier, org.id)
                .input('userId', sql.UniqueIdentifier, userId)
                .input('status', sql.NVarChar(30), 'ACTIVE')
                .query<{ id: string }>(`
                    INSERT INTO app.organization_memberships (organization_id, user_id, status)
                    OUTPUT INSERTED.id
                    VALUES (@organizationId, @userId, @status)
                `);
            const membershipId = membershipResult.recordset[0].id;

            // 3. Assign ORG_ADMIN role
            await transaction
                .request()
                .input('membershipId', sql.UniqueIdentifier, membershipId)
                .input('roleId', sql.UniqueIdentifier, orgAdminRoleId)
                .query(`
                    INSERT INTO app.organization_membership_roles (organization_membership_id, role_id)
                    VALUES (@membershipId, @roleId)
                `);

            await transaction.commit();
            return org;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    async findById(id: string): Promise<OrganizationRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query<OrganizationRow>(`
                SELECT id, name, slug, description, is_active, created_at, updated_at, deleted_at
                FROM app.organizations
                WHERE id = @id AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    async findBySlug(slug: string): Promise<OrganizationRow | null> {
        const result = await this.pool
            .request()
            .input('slug', sql.NVarChar(150), slug)
            .query<OrganizationRow>(`
                SELECT id, name, slug, description, is_active, created_at, updated_at, deleted_at
                FROM app.organizations
                WHERE slug = @slug AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    /** All active organizations a user is an ACTIVE member of */
    async findByUserId(userId: string): Promise<OrganizationRow[]> {
        const result = await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, userId)
            .query<OrganizationRow>(`
                SELECT o.id, o.name, o.slug, o.description, o.is_active, o.created_at, o.updated_at, o.deleted_at
                FROM app.organizations o
                INNER JOIN app.organization_memberships om
                    ON om.organization_id = o.id
                   AND om.user_id = @userId
                   AND om.status = N'ACTIVE'
                   AND om.left_at IS NULL
                WHERE o.deleted_at IS NULL AND o.is_active = 1
            `);
        return result.recordset;
    }

    /** All active organizations — for super admin */
    async findAll(): Promise<OrganizationRow[]> {
        const result = await this.pool
            .request()
            .query<OrganizationRow>(`
                SELECT id, name, slug, description, is_active, created_at, updated_at, deleted_at
                FROM app.organizations
                WHERE deleted_at IS NULL AND is_active = 1
                ORDER BY name
            `);
        return result.recordset;
    }

    // ── Memberships ───────────────────────────────────────────────────────────

    async createMembership(data: CreateMembershipData): Promise<MembershipRow> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, data.organizationId)
            .input('userId', sql.UniqueIdentifier, data.userId)
            .input('status', sql.NVarChar(30), data.status ?? 'ACTIVE')
            .query<MembershipRow>(`
                INSERT INTO app.organization_memberships (organization_id, user_id, status)
                OUTPUT
                    INSERTED.id, INSERTED.organization_id, INSERTED.user_id,
                    INSERTED.status, INSERTED.joined_at, INSERTED.left_at, INSERTED.created_at
                VALUES (@organizationId, @userId, @status)
            `);
        return result.recordset[0];
    }

    async findMembership(organizationId: string, userId: string): Promise<MembershipRow | null> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query<MembershipRow>(`
                SELECT id, organization_id, user_id, status, joined_at, left_at, created_at
                FROM app.organization_memberships
                WHERE organization_id = @organizationId AND user_id = @userId
            `);
        return result.recordset[0] ?? null;
    }

    async findMembershipById(membershipId: string): Promise<MembershipRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, membershipId)
            .query<MembershipRow>(`
                SELECT id, organization_id, user_id, status, joined_at, left_at, created_at
                FROM app.organization_memberships
                WHERE id = @id
            `);
        return result.recordset[0] ?? null;
    }

    /** Active members of an org with their user details and role codes */
    async findActiveMembers(organizationId: string): Promise<MemberWithRoles[]> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .query<{
                membershipId: string;
                userId: string;
                email: string;
                first_name: string | null;
                last_name: string | null;
                display_name: string | null;
                status: string;
                joined_at: Date;
                roleCode: string | null;
            }>(`
                SELECT
                    om.id          AS membershipId,
                    om.user_id     AS userId,
                    u.email,
                    u.first_name,
                    u.last_name,
                    u.display_name,
                    om.status,
                    om.joined_at,
                    r.code         AS roleCode
                FROM app.organization_memberships om
                INNER JOIN app.users u ON u.id = om.user_id AND u.deleted_at IS NULL
                LEFT JOIN app.organization_membership_roles omr ON omr.organization_membership_id = om.id
                LEFT JOIN app.roles r ON r.id = omr.role_id
                WHERE om.organization_id = @organizationId
                  AND om.status = N'ACTIVE'
                  AND om.left_at IS NULL
                ORDER BY om.joined_at
            `);

        // Group role codes by membership
        const map = new Map<string, MemberWithRoles>();
        for (const row of result.recordset) {
            if (!map.has(row.membershipId)) {
                map.set(row.membershipId, {
                    membershipId: row.membershipId,
                    userId: row.userId,
                    email: row.email,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    displayName: row.display_name,
                    status: row.status,
                    joinedAt: row.joined_at,
                    roles: [],
                });
            }
            if (row.roleCode) {
                map.get(row.membershipId)!.roles.push(row.roleCode);
            }
        }
        return Array.from(map.values());
    }

    // ── Roles ─────────────────────────────────────────────────────────────────

    async findRolesByCodes(codes: string[]): Promise<RoleRow[]> {
        if (codes.length === 0) return [];
        // Build parameterised IN list
        const inputs: Record<string, string> = {};
        codes.forEach((code, i) => { inputs[`code${i}`] = code; });
        const req = this.pool.request();
        Object.entries(inputs).forEach(([k, v]) => req.input(k, sql.NVarChar(50), v));
        const placeholders = Object.keys(inputs).map(k => `@${k}`).join(', ');
        const result = await req.query<RoleRow>(`
            SELECT id, code, name, description
            FROM app.roles
            WHERE code IN (${placeholders})
        `);
        return result.recordset;
    }

    async findRoleCodesByMembershipId(membershipId: string): Promise<string[]> {
        const result = await this.pool
            .request()
            .input('membershipId', sql.UniqueIdentifier, membershipId)
            .query<{ code: string }>(`
                SELECT r.code
                FROM app.organization_membership_roles omr
                INNER JOIN app.roles r ON r.id = omr.role_id
                WHERE omr.organization_membership_id = @membershipId
            `);
        return result.recordset.map(r => r.code);
    }

    /** Replace all roles for a membership (sequential — no transaction wrapper available at pool level) */
    async setMembershipRoles(membershipId: string, roleIds: string[]): Promise<void> {
        const req = this.pool.request().input('membershipId', sql.UniqueIdentifier, membershipId);

        // Delete existing
        await req.query(`
            DELETE FROM app.organization_membership_roles
            WHERE organization_membership_id = @membershipId
        `);

        // Insert new
        for (let i = 0; i < roleIds.length; i++) {
            await this.pool
                .request()
                .input('membershipId', sql.UniqueIdentifier, membershipId)
                .input(`roleId`, sql.UniqueIdentifier, roleIds[i])
                .query(`
                    INSERT INTO app.organization_membership_roles (organization_membership_id, role_id)
                    VALUES (@membershipId, @roleId)
                `);
        }
    }

    // ── Effective Permissions ─────────────────────────────────────────────────

    /**
     * Returns deduplicated permission codes for a user in an org:
     * role-based permissions UNION direct grants.
     */
    async findEffectivePermissions(organizationId: string, userId: string): Promise<string[]> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query<{ code: string }>(`
                -- Role-based permissions via membership
                SELECT DISTINCT p.code
                FROM app.organization_memberships om
                INNER JOIN app.organization_membership_roles omr
                    ON omr.organization_membership_id = om.id
                INNER JOIN app.role_permissions rp
                    ON rp.role_id = omr.role_id
                INNER JOIN app.permissions p
                    ON p.id = rp.permission_id
                WHERE om.organization_id = @organizationId
                  AND om.user_id = @userId
                  AND om.status = N'ACTIVE'
                  AND om.left_at IS NULL

                UNION

                -- Direct permission grants
                SELECT DISTINCT p.code
                FROM app.user_permission_grants upg
                INNER JOIN app.permissions p ON p.id = upg.permission_id
                WHERE upg.organization_id = @organizationId
                  AND upg.user_id = @userId
            `);
        return result.recordset.map(r => r.code);
    }
}

