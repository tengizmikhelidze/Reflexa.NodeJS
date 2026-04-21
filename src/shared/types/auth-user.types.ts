/**
 * The shape of the authenticated user attached to req.user
 * after the JWT access token is verified by auth middleware.
 *
 * Only contains what the app actually needs at the request level.
 * Deliberately minimal — not the full DB user row.
 */
export interface AuthUser {
    userId: string;
    email: string;
    emailVerified: boolean;
    isSuperAdmin: boolean;
}

