import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthUser } from '../types/auth-user.types.js';

// ─── JWT Payload ──────────────────────────────────────────────────────────────

/**
 * The shape we embed inside both access and refresh tokens.
 * Kept minimal — only what is needed to identify and authorise the user.
 * The full user record is fetched from the DB when needed (e.g. GET /me).
 */
export interface JwtPayload {
    sub: string;           // userId (standard JWT "subject" claim)
    email: string;
    emailVerified: boolean;
    isSuperAdmin: boolean;
}

// ─── Access Token ─────────────────────────────────────────────────────────────

/**
 * Signs a short-lived JWT access token.
 *
 * Strategy:
 * - Short lifetime (default 15 m) — limits damage if a token is stolen.
 * - Stateless — no DB lookup required to validate.
 * - Carries enough claims for middleware to authorise most requests
 *   without an extra DB round-trip.
 */
export function signAccessToken(user: AuthUser): string {
    const payload: JwtPayload = {
        sub: user.userId,
        email: user.email,
        emailVerified: user.emailVerified,
        isSuperAdmin: user.isSuperAdmin,
    };

    return jwt.sign(payload, env.jwtAccessSecret, {
        expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
    });
}

/**
 * Verifies a JWT access token and returns the decoded payload.
 * Throws a JsonWebTokenError / TokenExpiredError on failure —
 * callers (auth middleware) should catch and convert to UnauthorizedError.
 */
export function verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtAccessSecret) as JwtPayload;
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Signs a long-lived JWT refresh token.
 *
 * Strategy:
 * - Longer lifetime (default 7 d) — used only to obtain a new access token.
 * - A SHA-256 hash of this token is stored in app.refresh_tokens.
 * - On use: verify the JWT signature first (cheap), then look up the hash
 *   in the DB (confirms it hasn't been revoked).
 * - Rotated on every use: old row revoked, new token issued.
 * - If a revoked token is presented, all tokens for that user are revoked
 *   (reuse-attack detection — implement in service layer).
 */
export function signRefreshToken(user: AuthUser): string {
    const payload: JwtPayload = {
        sub: user.userId,
        email: user.email,
        emailVerified: user.emailVerified,
        isSuperAdmin: user.isSuperAdmin,
    };

    return jwt.sign(payload, env.jwtRefreshSecret, {
        expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
    });
}

/**
 * Verifies a JWT refresh token and returns the decoded payload.
 * Throws on invalid or expired tokens.
 */
export function verifyRefreshToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtRefreshSecret) as JwtPayload;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the expiry Date from a signed JWT without re-verifying the signature.
 * Used to set expires_at when storing a refresh token in the DB.
 */
export function getTokenExpiry(token: string): Date {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) {
        throw new Error('Token has no expiry claim');
    }
    return new Date(decoded.exp * 1000);
}

