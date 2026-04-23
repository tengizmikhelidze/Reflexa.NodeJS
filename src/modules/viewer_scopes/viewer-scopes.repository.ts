import sql from 'mssql';
import { ViewerScopeRow } from './viewer-scopes.types.js';

export interface CreateViewerScopeData {
    id: string;
    organizationId: string;
    viewerUserId: string;
    targetUserId: string;
    grantedByUserId: string | null;
}

export interface FindViewerScopesOptions {
    organizationId?: string;
    viewerUserId?: string;
}

export class ViewerScopesRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    async create(data: CreateViewerScopeData): Promise<ViewerScopeRow> {
        const result = await this.pool
            .request()
            .input('id',              sql.UniqueIdentifier, data.id)
            .input('organizationId',  sql.UniqueIdentifier, data.organizationId)
            .input('viewerUserId',    sql.UniqueIdentifier, data.viewerUserId)
            .input('targetUserId',    sql.UniqueIdentifier, data.targetUserId)
            .input('grantedByUserId', sql.UniqueIdentifier, data.grantedByUserId)
            .query<ViewerScopeRow>(`
                INSERT INTO app.viewer_access_scopes
                    (id, organization_id, viewer_user_id, target_user_id, granted_by_user_id)
                OUTPUT
                    INSERTED.id, INSERTED.organization_id, INSERTED.viewer_user_id,
                    INSERTED.target_user_id, INSERTED.granted_by_user_id, INSERTED.created_at
                VALUES (@id, @organizationId, @viewerUserId, @targetUserId, @grantedByUserId)
            `);
        return result.recordset[0];
    }

    async findById(scopeId: string): Promise<ViewerScopeRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, scopeId)
            .query<ViewerScopeRow>(`
                SELECT id, organization_id, viewer_user_id, target_user_id, granted_by_user_id, created_at
                FROM app.viewer_access_scopes
                WHERE id = @id
            `);
        return result.recordset[0] ?? null;
    }

    async findDuplicate(organizationId: string, viewerUserId: string, targetUserId: string): Promise<ViewerScopeRow | null> {
        const result = await this.pool
            .request()
            .input('organizationId', sql.UniqueIdentifier, organizationId)
            .input('viewerUserId',   sql.UniqueIdentifier, viewerUserId)
            .input('targetUserId',   sql.UniqueIdentifier, targetUserId)
            .query<ViewerScopeRow>(`
                SELECT id, organization_id, viewer_user_id, target_user_id, granted_by_user_id, created_at
                FROM app.viewer_access_scopes
                WHERE organization_id = @organizationId
                  AND viewer_user_id  = @viewerUserId
                  AND target_user_id  = @targetUserId
            `);
        return result.recordset[0] ?? null;
    }

    async findMany(opts: FindViewerScopesOptions): Promise<ViewerScopeRow[]> {
        const req = this.pool.request();
        const conditions: string[] = [];

        if (opts.organizationId) {
            req.input('organizationId', sql.UniqueIdentifier, opts.organizationId);
            conditions.push(`organization_id = @organizationId`);
        }
        if (opts.viewerUserId) {
            req.input('viewerUserId', sql.UniqueIdentifier, opts.viewerUserId);
            conditions.push(`viewer_user_id = @viewerUserId`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await req.query<ViewerScopeRow>(`
            SELECT id, organization_id, viewer_user_id, target_user_id, granted_by_user_id, created_at
            FROM app.viewer_access_scopes
            ${where}
            ORDER BY created_at DESC
        `);
        return result.recordset;
    }

    async delete(scopeId: string): Promise<void> {
        await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, scopeId)
            .query(`DELETE FROM app.viewer_access_scopes WHERE id = @id`);
    }
}

