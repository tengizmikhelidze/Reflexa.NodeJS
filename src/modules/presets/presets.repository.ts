import sql from 'mssql';
import { PresetRow } from './presets.types.js';

export interface CreatePresetData {
    id: string;
    organizationId: string | null;
    createdByUserId: string;
    scope: string;
    name: string;
    description?: string;
    configJson: string; // already JSON.stringified
}

export interface UpdatePresetData {
    name?: string;
    description?: string | null;
    configJson?: string; // already JSON.stringified
}

export interface FindPresetsOptions {
    scope?: string;
    organizationId?: string;
    createdByUserId?: string;
    /** For non-super-admin: list only presets the actor can see */
    actorUserId?: string;
    /** When true, returns ALL non-deleted presets (super admin) */
    isSuperAdmin?: boolean;
}

export class PresetsRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    // ── Create ────────────────────────────────────────────────────────────────

    async create(data: CreatePresetData): Promise<PresetRow> {
        const result = await this.pool
            .request()
            .input('id',                sql.UniqueIdentifier, data.id)
            .input('organizationId',    sql.UniqueIdentifier, data.organizationId)
            .input('createdByUserId',   sql.UniqueIdentifier, data.createdByUserId)
            .input('scope',             sql.NVarChar(20),     data.scope)
            .input('name',              sql.NVarChar(150),    data.name)
            .input('description',       sql.NVarChar(500),    data.description ?? null)
            .input('configJson',        sql.NVarChar(sql.MAX),data.configJson)
            .query<PresetRow>(`
                INSERT INTO app.training_presets
                    (id, organization_id, created_by_user_id, scope, name, description, config_json)
                OUTPUT
                    INSERTED.id, INSERTED.organization_id, INSERTED.created_by_user_id,
                    INSERTED.scope, INSERTED.name, INSERTED.description, INSERTED.config_json,
                    INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
                VALUES (@id, @organizationId, @createdByUserId, @scope, @name, @description, @configJson)
            `);
        return result.recordset[0];
    }

    // ── Find by ID ────────────────────────────────────────────────────────────

    async findById(presetId: string): Promise<PresetRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, presetId)
            .query<PresetRow>(`
                SELECT id, organization_id, created_by_user_id, scope, name, description,
                       config_json, created_at, updated_at, deleted_at
                FROM app.training_presets
                WHERE id = @id AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    /**
     * List presets visible to the actor:
     *   — personal presets they created
     *   — org presets from orgs they are an ACTIVE member of
     * Super admin: all non-deleted presets (with optional filters).
     */
    async findMany(opts: FindPresetsOptions): Promise<PresetRow[]> {
        const req = this.pool.request();

        let baseWhere = `tp.deleted_at IS NULL`;

        if (opts.scope) {
            req.input('scope', sql.NVarChar(20), opts.scope);
            baseWhere += ` AND tp.scope = @scope`;
        }

        if (opts.organizationId) {
            req.input('organizationId', sql.UniqueIdentifier, opts.organizationId);
            baseWhere += ` AND tp.organization_id = @organizationId`;
        }

        if (opts.createdByUserId) {
            req.input('createdByUserId', sql.UniqueIdentifier, opts.createdByUserId);
            baseWhere += ` AND tp.created_by_user_id = @createdByUserId`;
        }

        let query: string;

        if (opts.isSuperAdmin) {
            query = `
                SELECT tp.id, tp.organization_id, tp.created_by_user_id, tp.scope,
                       tp.name, tp.description, tp.config_json, tp.created_at, tp.updated_at, tp.deleted_at
                FROM app.training_presets tp
                WHERE ${baseWhere}
                ORDER BY tp.created_at DESC
            `;
        } else {
            // Actor sees: own personal presets OR org presets from their active orgs
            req.input('actorUserId', sql.UniqueIdentifier, opts.actorUserId!);
            query = `
                SELECT tp.id, tp.organization_id, tp.created_by_user_id, tp.scope,
                       tp.name, tp.description, tp.config_json, tp.created_at, tp.updated_at, tp.deleted_at
                FROM app.training_presets tp
                WHERE ${baseWhere}
                  AND (
                      -- Personal preset owned by actor
                      (tp.scope = N'USER' AND tp.created_by_user_id = @actorUserId)
                      OR
                      -- Org preset from an org the actor is an active member of
                      (tp.scope = N'ORGANIZATION' AND EXISTS (
                          SELECT 1 FROM app.organization_memberships om
                          WHERE om.organization_id = tp.organization_id
                            AND om.user_id = @actorUserId
                            AND om.status = N'ACTIVE'
                            AND om.left_at IS NULL
                      ))
                  )
                ORDER BY tp.created_at DESC
            `;
        }

        const result = await req.query<PresetRow>(query);
        return result.recordset;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    async update(presetId: string, data: UpdatePresetData): Promise<PresetRow | null> {
        const req = this.pool.request().input('id', sql.UniqueIdentifier, presetId);

        const setClauses: string[] = [`updated_at = SYSUTCDATETIME()`];

        if (data.name !== undefined) {
            req.input('name', sql.NVarChar(150), data.name);
            setClauses.push(`name = @name`);
        }
        if (data.description !== undefined) {
            req.input('description', sql.NVarChar(500), data.description);
            setClauses.push(`description = @description`);
        }
        if (data.configJson !== undefined) {
            req.input('configJson', sql.NVarChar(sql.MAX), data.configJson);
            setClauses.push(`config_json = @configJson`);
        }

        const result = await req.query<PresetRow>(`
            UPDATE app.training_presets
            SET ${setClauses.join(', ')}
            OUTPUT
                INSERTED.id, INSERTED.organization_id, INSERTED.created_by_user_id,
                INSERTED.scope, INSERTED.name, INSERTED.description, INSERTED.config_json,
                INSERTED.created_at, INSERTED.updated_at, INSERTED.deleted_at
            WHERE id = @id AND deleted_at IS NULL
        `);
        return result.recordset[0] ?? null;
    }

    // ── Soft Delete ───────────────────────────────────────────────────────────

    async softDelete(presetId: string): Promise<void> {
        await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, presetId)
            .query(`
                UPDATE app.training_presets
                SET deleted_at = SYSUTCDATETIME()
                WHERE id = @id AND deleted_at IS NULL
            `);
    }
}

