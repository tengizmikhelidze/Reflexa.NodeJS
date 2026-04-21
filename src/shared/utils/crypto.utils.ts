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

