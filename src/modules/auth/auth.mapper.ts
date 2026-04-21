import { UserRow } from '../users/users.types.js';
import { SafeUser } from './auth.types.js';

/**
 * Maps a raw DB UserRow to a SafeUser response shape.
 *
 * This is the single place where password_hash and other internal fields
 * are stripped. Any code that needs to return user data to a client must
 * go through this mapper — never return a UserRow directly.
 */
export function mapUserToSafeUser(row: UserRow): SafeUser {
    return {
        id: row.id,
        email: row.email,
        emailVerified: row.email_verified,
        firstName: row.first_name,
        lastName: row.last_name,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        isSuperAdmin: row.is_super_admin,
        createdAt: row.created_at,
    };
}


