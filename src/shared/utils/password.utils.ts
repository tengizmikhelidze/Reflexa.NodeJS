import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';

/**
 * Hashes a plain-text password using bcrypt.
 * Salt rounds come from env (default 12 — see BCRYPT_SALT_ROUNDS).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, env.bcryptSaltRounds);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Returns true if they match, false otherwise.
 * Uses bcrypt.compare which is timing-safe.
 */
export async function comparePassword(
    plainPassword: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
}

