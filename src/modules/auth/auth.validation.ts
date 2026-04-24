import { z } from 'zod';

/**
 * Normalises email: trim whitespace and convert to lowercase.
 * Applied consistently at the validation boundary so nothing
 * downstream ever sees a raw un-normalised email.
 */
const normalizedEmail = z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address');

/**
 * Password rules:
 * - min 8 characters
 * - at least one uppercase letter
 * - at least one number
 * These are intentionally minimal to avoid frustrating users
 * while still preventing trivially weak passwords.
 */
const password = z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
    email: normalizedEmail,
    password,
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    displayName: z.string().trim().max(200).optional(),
});

export type RegisterSchema = z.infer<typeof registerSchema>;

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
    email: normalizedEmail,
    // No strength rules on login — just presence
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export type LoginSchema = z.infer<typeof loginSchema>;

// ─── Verify Email ─────────────────────────────────────────────────────────────

export const verifyEmailSchema = z.object({
    token: z.string({ error: 'Token is required' }).min(1, 'Token is required'),
});

export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;

// Used by the GET link handler (token comes from query string, not body)
export const verifyEmailQuerySchema = verifyEmailSchema;

// ─── Resend Verification Email ────────────────────────────────────────────────

export const resendVerificationEmailSchema = z.object({
    email: normalizedEmail,
});

export type ResendVerificationEmailSchema = z.infer<typeof resendVerificationEmailSchema>;

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const refreshTokenSchema = z.object({
    refreshToken: z
        .string({ error: 'Refresh token is required' })
        .min(1, 'Refresh token is required'),
});

export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>;

