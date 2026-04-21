import sql from 'mssql';
import { UserRow } from './users.types.js';

export type { UserRow };

// ─── Create Input ─────────────────────────────────────────────────────────────

export interface CreateUserInput {
    email: string;           // raw email — DB computes normalized_email
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class UsersRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    /**
     * Look up a user by normalised email.
     * We pass UPPER(@email) and query normalized_email to hit the unique index.
     * Returns null if not found.
     */
    async findByEmail(email: string): Promise<UserRow | null> {
        const result = await this.pool
            .request()
            .input('normalizedEmail', sql.NVarChar(320), email.toUpperCase())
            .query<UserRow>(`
                SELECT
                    id, email, normalized_email, password_hash,
                    email_verified, first_name, last_name, display_name,
                    avatar_url, is_super_admin, is_active,
                    created_at, updated_at, deleted_at
                FROM app.users
                WHERE normalized_email = @normalizedEmail
                  AND deleted_at IS NULL
            `);

        return result.recordset[0] ?? null;
    }

    /**
     * Look up a user by their primary key UUID.
     * Returns null if not found or soft-deleted.
     */
    async findById(id: string): Promise<UserRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query<UserRow>(`
                SELECT
                    id, email, normalized_email, password_hash,
                    email_verified, first_name, last_name, display_name,
                    avatar_url, is_super_admin, is_active,
                    created_at, updated_at, deleted_at
                FROM app.users
                WHERE id = @id
                  AND deleted_at IS NULL
            `);

        return result.recordset[0] ?? null;
    }

    /**
     * Insert a new user row.
     * Does NOT insert normalized_email — it is a computed persisted column.
     * Returns the full newly created row.
     */
    async create(input: CreateUserInput): Promise<UserRow> {
        const result = await this.pool
            .request()
            .input('email', sql.NVarChar(320), input.email)
            .input('passwordHash', sql.NVarChar(512), input.passwordHash)
            .input('firstName', sql.NVarChar(100), input.firstName ?? null)
            .input('lastName', sql.NVarChar(100), input.lastName ?? null)
            .input('displayName', sql.NVarChar(200), input.displayName ?? null)
            .query<UserRow>(`
                INSERT INTO app.users
                    (email, password_hash, first_name, last_name, display_name)
                OUTPUT
                    INSERTED.id,
                    INSERTED.email,
                    INSERTED.normalized_email,
                    INSERTED.password_hash,
                    INSERTED.email_verified,
                    INSERTED.first_name,
                    INSERTED.last_name,
                    INSERTED.display_name,
                    INSERTED.avatar_url,
                    INSERTED.is_super_admin,
                    INSERTED.is_active,
                    INSERTED.created_at,
                    INSERTED.updated_at,
                    INSERTED.deleted_at
                VALUES
                    (@email, @passwordHash, @firstName, @lastName, @displayName)
            `);

        return result.recordset[0];
    }

    /**
     * Mark email_verified = 1 and update updated_at for a given user.
     */
    async markEmailVerified(userId: string): Promise<void> {
        await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, userId)
            .query(`
                UPDATE app.users
                SET email_verified = 1,
                    updated_at     = SYSUTCDATETIME()
                WHERE id = @userId
            `);
    }
}


