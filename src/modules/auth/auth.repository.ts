import sql from 'mssql';

// ─── Row Types ────────────────────────────────────────────────────────────────

export interface EmailVerificationTokenRow {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
}

export interface RefreshTokenRow {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked_at: Date | null;
    created_at: Date;
}

// ─── Create Inputs ────────────────────────────────────────────────────────────

export interface CreateEmailVerificationTokenInput {
    userId: string;
    token: string;       // plain token — hashing not required; token is random enough
    expiresAt: Date;
}

export interface CreateRefreshTokenInput {
    userId: string;
    tokenHash: string;   // SHA-256 hex hash of the raw refresh token
    expiresAt: Date;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class AuthRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    // ── Email Verification Tokens ─────────────────────────────────────────────

    /**
     * Store a new email verification token.
     */
    async createEmailVerificationToken(
        input: CreateEmailVerificationTokenInput
    ): Promise<void> {
        await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, input.userId)
            .input('token', sql.NVarChar(255), input.token)
            .input('expiresAt', sql.DateTime2, input.expiresAt)
            .query(`
                INSERT INTO app.email_verification_tokens (user_id, token, expires_at)
                VALUES (@userId, @token, @expiresAt)
            `);
    }

    /**
     * Find a verification token record by the raw token string.
     * Returns null if not found.
     */
    async findEmailVerificationToken(
        token: string
    ): Promise<EmailVerificationTokenRow | null> {
        const result = await this.pool
            .request()
            .input('token', sql.NVarChar(255), token)
            .query<EmailVerificationTokenRow>(`
                SELECT id, user_id, token, expires_at, used_at, created_at
                FROM app.email_verification_tokens
                WHERE token = @token
            `);

        return result.recordset[0] ?? null;
    }

    /**
     * Mark a verification token as used (set used_at = now).
     */
    async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
        await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, tokenId)
            .query(`
                UPDATE app.email_verification_tokens
                SET used_at = SYSUTCDATETIME()
                WHERE id = @id
            `);
    }

    // ── Refresh Tokens ────────────────────────────────────────────────────────

    /**
     * Store a new hashed refresh token for a user.
     */
    async createRefreshToken(input: CreateRefreshTokenInput): Promise<void> {
        await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, input.userId)
            .input('tokenHash', sql.NVarChar(512), input.tokenHash)
            .input('expiresAt', sql.DateTime2, input.expiresAt)
            .query(`
                INSERT INTO app.refresh_tokens (user_id, token_hash, expires_at)
                VALUES (@userId, @tokenHash, @expiresAt)
            `);
    }

    /**
     * Find a refresh token record by its stored hash.
     * Returns null if not found.
     */
    async findRefreshTokenByHash(
        tokenHash: string
    ): Promise<RefreshTokenRow | null> {
        const result = await this.pool
            .request()
            .input('tokenHash', sql.NVarChar(512), tokenHash)
            .query<RefreshTokenRow>(`
                SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
                FROM app.refresh_tokens
                WHERE token_hash = @tokenHash
            `);

        return result.recordset[0] ?? null;
    }

    /**
     * Find all active (non-revoked, non-expired) refresh tokens for a user.
     * Used to enforce single-session or detect token reuse attacks.
     */
    async findActiveRefreshTokensByUserId(
        userId: string
    ): Promise<RefreshTokenRow[]> {
        const result = await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, userId)
            .query<RefreshTokenRow>(`
                SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
                FROM app.refresh_tokens
                WHERE user_id   = @userId
                  AND revoked_at IS NULL
                  AND expires_at  > SYSUTCDATETIME()
            `);

        return result.recordset;
    }

    /**
     * Revoke a single refresh token by its row ID.
     * Called during rotation (old token revoked, new one inserted).
     */
    async revokeRefreshToken(tokenId: string): Promise<void> {
        await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, tokenId)
            .query(`
                UPDATE app.refresh_tokens
                SET revoked_at = SYSUTCDATETIME()
                WHERE id = @id
            `);
    }

    /**
     * Revoke ALL active refresh tokens for a user.
     * Called on logout or detected token reuse attack.
     */
    async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
        await this.pool
            .request()
            .input('userId', sql.UniqueIdentifier, userId)
            .query(`
                UPDATE app.refresh_tokens
                SET revoked_at = SYSUTCDATETIME()
                WHERE user_id   = @userId
                  AND revoked_at IS NULL
            `);
    }
}

