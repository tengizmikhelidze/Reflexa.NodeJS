/**
 * Shared user types used across modules (auth, organizations, teams, sessions).
 * Kept separate from auth-specific types so other modules can import cleanly.
 */

/**
 * Full DB row shape for app.users.
 * Exported from users.repository.ts but also re-declared here
 * so other modules can reference the type without importing the repository.
 */
export interface UserRow {
    id: string;
    email: string;
    normalized_email: string;
    password_hash: string | null;
    email_verified: boolean;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

