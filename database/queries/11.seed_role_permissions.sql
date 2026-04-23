USE [Reflexa];
GO

-- =============================================================================
-- Seed role_permissions — maps each role to its allowed permission codes.
--
-- This script is fully IDEMPOTENT: safe to run multiple times.
-- It will never insert a duplicate row (PK = role_id + permission_id).
--
-- Roles seeded here:
--   ORG_ADMIN  — full org management
--   TRAINER    — session management + preset/team management
--   ATHLETE    — no permissions (self-access only via assigned_to / started_by)
--   VIEWER     — no permissions (visibility via viewer_access_scopes only)
--   SUPER_ADMIN — not seeded here; bypassed via users.is_super_admin flag
--
-- Permission → Visibility impact:
--   A user with ANY of: session.start, session.end, session.assign, session.delete
--   is treated as "elevated" and can see ALL sessions in their org.
--   A user with NONE of those permissions can only see their own sessions.
-- =============================================================================

-- ── Helper: idempotent INSERT for a single (role_code, permission_code) pair ──
-- Pattern: SELECT role.id, permission.id WHERE NOT EXISTS (already linked)

-- =============================================================================
-- ORG_ADMIN permissions
-- =============================================================================

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'users.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'teams.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'devices.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'presets.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'session.start'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'session.end'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'session.assign'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'session.delete'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'ORG_ADMIN' AND p.code = 'viewer.scope.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

GO

-- =============================================================================
-- TRAINER permissions
-- Trainers can manage sessions, assign sessions to athletes, manage presets
-- and manage their team rosters. They do NOT manage users or devices at the
-- org level (device kit registration is an admin task).
-- =============================================================================

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'TRAINER' AND p.code = 'session.start'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'TRAINER' AND p.code = 'session.end'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'TRAINER' AND p.code = 'session.assign'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'TRAINER' AND p.code = 'presets.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'TRAINER' AND p.code = 'teams.manage'
  AND NOT EXISTS (SELECT 1 FROM app.role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

GO

-- =============================================================================
-- ATHLETE — no permissions
-- Athletes rely entirely on self-access rules:
--   - assigned_to_user_id = their userId
--   - started_by_user_id  = their userId
-- =============================================================================

-- (intentionally empty — no row_permissions for ATHLETE)

-- =============================================================================
-- VIEWER — no permissions
-- Viewers rely entirely on app.viewer_access_scopes grants.
-- A user with VIEWER role sees only sessions for their granted target users.
-- viewer.scope.manage is NOT granted to VIEWER — admins/trainers manage scopes.
-- =============================================================================

-- (intentionally empty — no role_permissions for VIEWER)

GO

-- =============================================================================
-- Verification query — run this to confirm the seeded mappings
-- =============================================================================

/*
SELECT
    r.code  AS role,
    p.code  AS permission
FROM app.role_permissions rp
INNER JOIN app.roles       r ON r.id = rp.role_id
INNER JOIN app.permissions p ON p.id = rp.permission_id
ORDER BY r.code, p.code;
*/

