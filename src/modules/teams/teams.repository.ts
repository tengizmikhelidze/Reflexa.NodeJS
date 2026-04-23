import sql from 'mssql';
import { TeamRow, TeamMembershipRow, TeamMemberSummary } from './teams.types.js';

export interface CreateTeamData {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
}

export class TeamsRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    // ── Teams ─────────────────────────────────────────────────────────────────

    async create(data: CreateTeamData): Promise<TeamRow> {
        const result = await this.pool
            .request()
            .input('id',             sql.UniqueIdentifier, data.id)
            .input('organizationId', sql.UniqueIdentifier, data.organizationId)
            .input('name',           sql.NVarChar(150),    data.name)
            .input('description',    sql.NVarChar(500),    data.description ?? null)
            .query<TeamRow>(`
                INSERT INTO app.teams (id, organization_id, name, description)
                OUTPUT
                    INSERTED.id, INSERTED.organization_id, INSERTED.name,
                    INSERTED.description, INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                VALUES (@id, @organizationId, @name, @description)
            `);
        return result.recordset[0];
    }

    async findById(teamId: string): Promise<TeamRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, teamId)
            .query<TeamRow>(`
                SELECT id, organization_id, name, description, created_at, updated_at, deleted_at
                FROM app.teams
                WHERE id = @id AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    async findByOrgAndName(organizationId: string, name: string): Promise<TeamRow | null> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .input('name',           sql.NVarChar(150),    name)
            .query<TeamRow>(`
                SELECT id, organization_id, name, description, created_at, updated_at, deleted_at
                FROM app.teams
                WHERE organization_id = @organizationId AND name = @name AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    /**
     * List active teams for an org, or all non-deleted teams (super admin).
     */
    async findMany(opts: { organizationId?: string; actorUserId?: string; isSuperAdmin?: boolean }): Promise<TeamRow[]> {
        const req = this.pool.request();
        let where = `t.deleted_at IS NULL`;

        if (opts.organizationId) {
            req.input('organizationId', sql.UniqueIdentifier, opts.organizationId);
            where += ` AND t.organization_id = @organizationId`;
        }

        let query: string;

        if (opts.isSuperAdmin) {
            query = `
                SELECT t.id, t.organization_id, t.name, t.description, t.created_at, t.updated_at, t.deleted_at
                FROM app.teams t
                WHERE ${where}
                ORDER BY t.name
            `;
        } else {
            // Regular user: only teams from orgs they are active members of
            req.input('actorUserId', sql.UniqueIdentifier, opts.actorUserId!);
            query = `
                SELECT t.id, t.organization_id, t.name, t.description, t.created_at, t.updated_at, t.deleted_at
                FROM app.teams t
                WHERE ${where}
                  AND EXISTS (
                      SELECT 1 FROM app.organization_memberships om
                      WHERE om.organization_id = t.organization_id
                        AND om.user_id = @actorUserId
                        AND om.status = N'ACTIVE'
                        AND om.left_at IS NULL
                  )
                ORDER BY t.name
            `;
        }

        const result = await req.query<TeamRow>(query);
        return result.recordset;
    }

    async countMembers(teamId: string): Promise<number> {
        const result = await this.pool
            .request()
            .input('teamId', sql.UniqueIdentifier, teamId)
            .query<{ cnt: number }>(`
                SELECT COUNT(*) AS cnt
                FROM app.team_memberships
                WHERE team_id = @teamId
            `);
        return result.recordset[0]?.cnt ?? 0;
    }

    // ── Team Memberships ──────────────────────────────────────────────────────

    async addMember(id: string, teamId: string, userId: string): Promise<TeamMembershipRow> {
        const result = await this.pool
            .request()
            .input('id',     sql.UniqueIdentifier, id)
            .input('teamId', sql.UniqueIdentifier, teamId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query<TeamMembershipRow>(`
                INSERT INTO app.team_memberships (id, team_id, user_id)
                OUTPUT INSERTED.id, INSERTED.team_id, INSERTED.user_id, INSERTED.created_at
                VALUES (@id, @teamId, @userId)
            `);
        return result.recordset[0];
    }

    async findMembership(teamId: string, userId: string): Promise<TeamMembershipRow | null> {
        const result = await this.pool
            .request()
            .input('teamId', sql.UniqueIdentifier, teamId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query<TeamMembershipRow>(`
                SELECT id, team_id, user_id, created_at
                FROM app.team_memberships
                WHERE team_id = @teamId AND user_id = @userId
            `);
        return result.recordset[0] ?? null;
    }

    async removeMember(teamId: string, userId: string): Promise<void> {
        await this.pool
            .request()
            .input('teamId', sql.UniqueIdentifier, teamId)
            .input('userId', sql.UniqueIdentifier, userId)
            .query(`
                DELETE FROM app.team_memberships
                WHERE team_id = @teamId AND user_id = @userId
            `);
    }

    async findMembers(teamId: string): Promise<TeamMemberSummary[]> {
        const result = await this.pool
            .request()
            .input('teamId', sql.UniqueIdentifier, teamId)
            .query<{
                id: string;
                team_id: string;
                user_id: string;
                email: string;
                first_name: string | null;
                last_name: string | null;
                display_name: string | null;
                created_at: Date;
            }>(`
                SELECT
                    tm.id,
                    tm.team_id,
                    tm.user_id,
                    u.email,
                    u.first_name,
                    u.last_name,
                    u.display_name,
                    tm.created_at
                FROM app.team_memberships tm
                INNER JOIN app.users u ON u.id = tm.user_id AND u.deleted_at IS NULL
                WHERE tm.team_id = @teamId
                ORDER BY tm.created_at
            `);
        return result.recordset.map(row => ({
            id:          row.id,
            teamId:      row.team_id,
            userId:      row.user_id,
            email:       row.email,
            firstName:   row.first_name,
            lastName:    row.last_name,
            displayName: row.display_name,
            joinedAt:    row.created_at,
        }));
    }
}

