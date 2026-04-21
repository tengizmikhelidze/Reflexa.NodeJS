import crypto from 'crypto';

/**
 * Generates a cryptographically secure random token.
 *
 * Strategy for email verification tokens:
 * - 32 random bytes → 64-character hex string.
 * - Stored as plain text in app.email_verification_tokens.token (NVARCHAR 255).
 * - The token itself is random enough (256 bits of entropy) that it does not
 *   need to be hashed — unlike refresh tokens which are JWTs and need
 *   hash-based revocation checks.
 * - Expires after EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS hours (default 24).
 * - Marked used_at when consumed; expired or used tokens are rejected.
 *
 * @param bytes Number of random bytes (default 32 → 64-char hex output)
 */
export function generateSecureToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Produces a deterministic SHA-256 hex hash of a string value.
 *
 * Used to hash refresh tokens before storing in app.refresh_tokens.token_hash.
 * SHA-256 is correct here — unlike bcrypt, it is deterministic, which allows
 * DB lookup by hash (WHERE token_hash = @hash).
 * bcrypt cannot be used for this because its random salt makes each hash unique.
 */
export function hashToken(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

