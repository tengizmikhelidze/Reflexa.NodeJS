import { env } from '../../config/env.js';
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
} from '../../shared/errors/http-errors.js';
import { hashToken, generateSecureToken } from '../../shared/utils/crypto.utils.js';
import { hashPassword, comparePassword } from '../../shared/utils/password.utils.js';
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    getTokenExpiry,
} from '../../shared/utils/token.utils.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';
import { EmailService } from '../../shared/services/email.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthRepository } from './auth.repository.js';
import { mapUserToSafeUser } from './auth.mapper.js';
import {
    LoginInput,
    LoginResponse,
    RefreshTokenInput,
    RefreshTokenResponse,
    RegisterInput,
    RegisterResponse,
    ResendVerificationEmailInput,
    SafeUser,
    TokenPair,
} from './auth.types.js';

export class AuthService {
    constructor(
        private readonly usersRepo: UsersRepository,
        private readonly authRepo: AuthRepository,
        private readonly emailService: EmailService
    ) {}

    // ── Register ──────────────────────────────────────────────────────────────

    /**
     * Creates a new user account and generates an email verification token.
     *
     * Decision: unverified users cannot log in.
     * Register returns the safe user + a message asking them to verify.
     * No tokens are issued here — login is gated on email_verified = true.
     */
    async register(input: RegisterInput): Promise<RegisterResponse> {
        // Email arrives already normalised (lowercased) from the Zod schema
        const existing = await this.usersRepo.findByEmail(input.email);
        if (existing) {
            throw new ConflictError('An account with this email already exists.');
        }

        const passwordHash = await hashPassword(input.password);

        const newUser = await this.usersRepo.create({
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: input.displayName,
        });

        // Generate a random verification token and store it
        const verificationToken = generateSecureToken();
        const expiresAt = new Date(
            Date.now() + env.emailVerificationTokenExpiresHours * 60 * 60 * 1000
        );

        await this.authRepo.createEmailVerificationToken({
            userId: newUser.id,
            token: verificationToken,
            expiresAt,
        });

        await this.emailService.sendVerificationEmail(newUser.email, verificationToken);

        return {
            user: mapUserToSafeUser(newUser),
            message:
                'Registration successful. Please check your email to verify your account.',
        };
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    /**
     * Authenticates a user and issues a JWT access + refresh token pair.
     *
     * Decision: email must be verified before login is permitted.
     * Rationale: unverified emails mean we cannot confirm the user owns the
     * address. Allowing login before verification would let anyone register
     * with someone else's email and immediately access the system.
     * A "resend verification" endpoint handles the recovery path.
     */
    async login(input: LoginInput): Promise<LoginResponse> {
        const user = await this.usersRepo.findByEmail(input.email);

        // Use a generic message for both "not found" and "wrong password"
        // to avoid leaking which emails are registered (user enumeration).
        if (!user || !user.password_hash) {
            throw new UnauthorizedError('Invalid email or password.');
        }

        const passwordMatch = await comparePassword(input.password, user.password_hash);
        if (!passwordMatch) {
            throw new UnauthorizedError('Invalid email or password.');
        }

        if (!user.is_active) {
            throw new ForbiddenError('Your account has been deactivated. Please contact support.');
        }

        if (!user.email_verified) {
            throw new ForbiddenError(
                'Email address has not been verified. Please check your inbox.'
            );
        }

        const tokens = await this.issueTokenPair({
            userId: user.id,
            email: user.email,
            emailVerified: user.email_verified,
            isSuperAdmin: user.is_super_admin,
        });

        return {
            user: mapUserToSafeUser(user),
            tokens,
        };
    }

    // ── Resend Verification Email ─────────────────────────────────────────────

    /**
     * Issues a fresh verification token and re-sends the verification email.
     *
     * Always responds with the same generic message regardless of whether the
     * email exists or is already verified — prevents user enumeration.
     */
    async resendVerificationEmail(input: ResendVerificationEmailInput): Promise<void> {
        const GENERIC_MESSAGE = 'If that email is registered and unverified, a new verification link has been sent.';

        const user = await this.usersRepo.findByEmail(input.email);

        // Silently succeed for unknown emails — don't reveal registration state
        if (!user) return;

        // Already verified — nothing to do, silently succeed
        if (user.email_verified) return;

        // Invalidate all existing pending tokens, then issue a fresh one
        await this.authRepo.deleteUnusedVerificationTokensForUser(user.id);

        const verificationToken = generateSecureToken();
        const expiresAt = new Date(
            Date.now() + env.emailVerificationTokenExpiresHours * 60 * 60 * 1000
        );

        await this.authRepo.createEmailVerificationToken({
            userId: user.id,
            token: verificationToken,
            expiresAt,
        });

        await this.emailService.sendVerificationEmail(user.email, verificationToken);
    }

    // ── Verify Email ──────────────────────────────────────────────────────────

    async verifyEmail(token: string): Promise<void> {
        const record = await this.authRepo.findEmailVerificationToken(token);

        if (!record) {
            // 404: token string does not exist at all
            throw new NotFoundError('Verification token is invalid.');
        }

        if (record.used_at !== null) {
            // 409 Conflict: token exists but has already been consumed — not an auth failure
            throw new ConflictError('Verification token has already been used.');
        }

        if (new Date() > record.expires_at) {
            // 403 Forbidden: token is genuine but no longer valid — tell client to request a new one
            throw new ForbiddenError(
                'Verification token has expired. Please request a new one.'
            );
        }

        // Order matters for crash safety:
        // Mark user verified FIRST, then mark token used.
        // If we crash after user verified but before token used → token can still be retried → safe.
        // If we crash after token used but before user verified → user is stuck unverified
        //   with a consumed token and cannot recover without support → dangerous.
        await this.usersRepo.markEmailVerified(record.user_id);
        await this.authRepo.markEmailVerificationTokenUsed(record.id);
    }

    // ── Refresh Token ─────────────────────────────────────────────────────────

    /**
     * Validates an incoming refresh token, rotates it, and issues a new token pair.
     *
     * Rotation strategy:
     * 1. Verify JWT signature and expiry (cheap, no DB).
     * 2. Hash the presented token and look it up in the DB.
     * 3. If the record is revoked → reuse attack detected → revoke ALL tokens for
     *    this user and throw, forcing a full re-login.
     * 4. If valid → revoke the old record, issue and store a new pair.
     */
    async refreshToken(input: RefreshTokenInput): Promise<RefreshTokenResponse> {
        // Step 1: verify JWT signature — throws if expired or tampered
        let payload: ReturnType<typeof verifyRefreshToken>;
        try {
            payload = verifyRefreshToken(input.refreshToken);
        } catch {
            throw new UnauthorizedError('Refresh token is invalid or expired.');
        }

        // Step 2: look up the hash in the DB
        const tokenHash = hashToken(input.refreshToken);
        const storedToken = await this.authRepo.findRefreshTokenByHash(tokenHash);

        if (!storedToken) {
            // Token is not in DB at all — possible reuse of a rotated token
            await this.authRepo.revokeAllRefreshTokensForUser(payload.sub);
            throw new UnauthorizedError(
                'Refresh token not recognised. All sessions have been invalidated.'
            );
        }

        if (storedToken.revoked_at !== null) {
            // Token was already revoked — reuse attack
            await this.authRepo.revokeAllRefreshTokensForUser(payload.sub);
            throw new UnauthorizedError(
                'Refresh token has been revoked. All sessions have been invalidated.'
            );
        }

        // Defence-in-depth: also check DB-level expiry.
        // The JWT exp claim is the primary guard, but DB expiry catches clock-skew edge cases.
        if (new Date() > storedToken.expires_at) {
            await this.authRepo.revokeRefreshToken(storedToken.id);
            throw new UnauthorizedError('Refresh token has expired. Please log in again.');
        }

        // Fetch user to get current state (they may have been deactivated since token was issued)
        const user = await this.usersRepo.findById(payload.sub);
        if (!user || !user.is_active) {
            throw new ForbiddenError('Account is inactive.');
        }

        // Step 4: rotate — revoke old, issue new
        await this.authRepo.revokeRefreshToken(storedToken.id);

        const tokens = await this.issueTokenPair({
            userId: user.id,
            email: user.email,
            emailVerified: user.email_verified,
            isSuperAdmin: user.is_super_admin,
        });

        return { tokens };
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Revokes the specific refresh token presented, effectively logging out
     * the current session. Other sessions (other devices) remain active.
     * Pass the raw refresh token from the client.
     */
    async logout(rawRefreshToken: string): Promise<void> {
        const tokenHash = hashToken(rawRefreshToken);
        const storedToken = await this.authRepo.findRefreshTokenByHash(tokenHash);

        // Silently succeed if token is not found — idempotent logout
        if (storedToken && storedToken.revoked_at === null) {
            await this.authRepo.revokeRefreshToken(storedToken.id);
        }
    }

    // ── Get Current User ──────────────────────────────────────────────────────

    /**
     * Returns the safe user record for the currently authenticated user.
     * The userId comes from the verified JWT payload attached to req.user
     * by authMiddleware — the controller passes it here.
     */
    async getMe(userId: string): Promise<SafeUser> {
        const user = await this.usersRepo.findById(userId);

        if (!user) {
            throw new NotFoundError('User not found.');
        }

        // Re-check active status — the user may have been deactivated after their token was issued.
        // findById already excludes soft-deleted rows (deleted_at IS NULL), so a missing row
        // also covers the deleted case.
        if (!user.is_active) {
            throw new ForbiddenError('Your account has been deactivated. Please contact support.');
        }

        return mapUserToSafeUser(user);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    /**
     * Signs an access + refresh token pair, hashes the refresh token,
     * and persists the hash to the DB.
     */
    private async issueTokenPair(authUser: AuthUser): Promise<TokenPair> {
        const accessToken = signAccessToken(authUser);
        const refreshToken = signRefreshToken(authUser);

        const tokenHash = hashToken(refreshToken);
        const expiresAt = getTokenExpiry(refreshToken);

        await this.authRepo.createRefreshToken({
            userId: authUser.userId,
            tokenHash,
            expiresAt,
        });

        return { accessToken, refreshToken };
    }
}

