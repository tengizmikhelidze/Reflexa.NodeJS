// ─── Request Inputs ───────────────────────────────────────────────────────────

export interface RegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface VerifyEmailInput {
    token: string;
}

export interface RefreshTokenInput {
    refreshToken: string;
}

// ─── Response Payloads ────────────────────────────────────────────────────────

/** Safe user data returned in auth responses. Never includes password_hash. */
export interface SafeUser {
    id: string;
    email: string;
    emailVerified: boolean;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
    createdAt: Date;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface RegisterResponse {
    user: SafeUser;
    message: string;
}

export interface LoginResponse {
    user: SafeUser;
    tokens: TokenPair;
}

export interface RefreshTokenResponse {
    tokens: TokenPair;
}

