import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../shared/utils/token.utils.js';
import { UnauthorizedError } from '../shared/errors/http-errors.js';

/**
 * Verifies the JWT access token from the Authorization header.
 * Attaches the decoded payload as req.user (typed as AuthUser).
 * Throws UnauthorizedError if the token is missing, invalid, or expired.
 *
 * Usage: apply to any route that requires authentication.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Authorization header is missing or malformed.'));
    }

    const token = authHeader.slice(7); // strip "Bearer "

    try {
        const payload = verifyAccessToken(token);

        req.user = {
            userId: payload.sub,
            email: payload.email,
            emailVerified: payload.emailVerified,
            isSuperAdmin: payload.isSuperAdmin,
        };

        next();
    } catch {
        next(new UnauthorizedError('Access token is invalid or expired.'));
    }
}

