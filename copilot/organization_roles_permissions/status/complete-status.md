# Organizations + Roles/Permissions Phase — Complete Status

Generated: 2026-04-21
TypeScript: ✅ `npx tsc --noEmit` — zero errors

---

## Files Created

| File | Purpose |
|------|---------|
| `src/modules/organizations/organizations.types.ts` | DB row types, request inputs, response payloads |
| `src/modules/organizations/organizations.validation.ts` | Zod schemas for all endpoints + path params |
| `src/modules/organizations/organizations.repository.ts` | All SQL access for orgs, memberships, roles, permissions |
| `src/modules/organizations/organizations.mapper.ts` | DB row → API response shape conversions |
| `src/modules/organizations/organizations.service.ts` | All business logic |
| `src/modules/organizations/organizations.controller.ts` | Thin HTTP handlers |
| `src/modules/organizations/organizations.routes.ts` | Route wiring + dependency composition |

## Files Modified

| File | Change |
|------|--------|
| `src/routes/index.ts` | Registered organizations router at `/api/organizations` |
| `src/shared/middlewares/validate.middleware.ts` | Added `target` param to support `'params'` validation |

---

## Schema Verification — No Mismatches

All queries verified against `database/queries/4.org_roles_teams_visibility.sql` and `database/queries/10.seed_esential_roles_and_perms.sql`.

| Table | Columns used | Status |
|-------|-------------|--------|
| `app.organizations` | `id, name, slug, description, is_active, created_at, updated_at, deleted_at` | ✅ Match |
| `app.organization_memberships` | `id, organization_id, user_id, status, joined_at, left_at, created_at` | ✅ Match |
| `app.organization_membership_roles` | `organization_membership_id, role_id` | ✅ Match |
| `app.roles` | `id, code, name, description` | ✅ Match |
| `app.role_permissions` | `role_id, permission_id` | ✅ Match |
| `app.permissions` | `id, code` | ✅ Match |
| `app.user_permission_grants` | `organization_id, user_id, permission_id` | ✅ Match |

No migration required.

---

## Endpoint List

Base: `http://localhost:3000/api`

All organization endpoints require `Authorization: Bearer <accessToken>`.

| Method | Path | Permission required | Description |
|--------|------|---------------------|-------------|
| `POST` | `/api/organizations` | authenticated | Create organization; creator gets ORG_ADMIN |
| `GET` | `/api/organizations` | authenticated | List orgs current user belongs to (super admin: all) |
| `GET` | `/api/organizations/:organizationId/me` | active member | My access profile: org + membership + roles + permissions |
| `POST` | `/api/organizations/:organizationId/members` | `users.manage` | Add existing user by email |
| `GET` | `/api/organizations/:organizationId/members` | `users.manage` | List active members with roles |
| `POST` | `/api/organizations/:organizationId/members/:membershipId/roles` | `users.manage` | Replace role assignment for a membership |
| `GET` | `/api/organizations/:organizationId/members/:membershipId/permissions` | self OR `users.manage` | Get effective permissions for a membership |

---

## Business Rules Implemented

### Organization Creation
1. Reject duplicate slug → 409
2. Insert `app.organizations`
3. Create `ACTIVE` membership for creator
4. Assign `ORG_ADMIN` role to that membership

### Membership Status
- Only `status = 'ACTIVE'` AND `left_at IS NULL` memberships grant access
- `INVITED` and `SUSPENDED` memberships are inactive

### Effective Permissions
SQL `UNION` of:
- Role-based: `membership → membership_roles → role_permissions → permissions`
- Direct grants: `user_permission_grants → permissions`

Deduplication handled at SQL level via `DISTINCT`.

### Super Admin
- Bypasses all `requirePermission()` checks
- `GET /organizations` returns ALL active orgs
- Cannot bypass active membership requirement for `GET /:id/me` (must be a member to get access profile)

### Permission Checks
- `requirePermission(orgId, actor, 'users.manage')` used for member/role management
- Self-access allowed for `GET .../permissions` (own membership)

---

## Validation

| Endpoint | Schema |
|----------|--------|
| `POST /organizations` | `createOrganizationSchema` — name (max 200), slug (lowercase/hyphens, max 150), description optional |
| `POST .../members` | `addMemberSchema` — email (normalised), roleCodes optional array |
| `POST .../roles` | `assignRolesSchema` — roleCodes array, min 1 item |
| All `/:organizationId` routes | `organizationIdParamSchema` — must be valid UUID |
| All `/:membershipId` routes | `membershipIdParamSchema` — both params must be valid UUIDs |

---

## `validate.middleware.ts` Enhancement

Added optional `target: 'body' | 'params'` second argument.

```typescript
validate(schema)            // validates req.body (default, backward compatible)
validate(schema, 'params')  // validates req.params
```

Used in routes to validate path-param UUIDs before any service call, returning a clean 400 instead of letting a malformed UUID reach the DB layer.

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Controllers: no business logic | ✅ |
| Services: no SQL | ✅ |
| Repositories: no HTTP/business logic | ✅ |
| All routes protected by `authMiddleware` | ✅ |
| Zod validation on all inputs + path params | ✅ |
| `password_hash` never exposed | ✅ (not referenced in this module) |
| Super admin bypass centralised in service | ✅ |
| `requirePermission` reusable for future modules | ✅ |

---

## Test Order

### Prerequisites
```
npm run dev
# Must be logged in as a verified user — have accessToken ready
# Seed roles: run database/queries/10.seed_esential_roles_and_perms.sql
```

### 1. Create Organization
```http
POST /api/organizations
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "name": "Reflexa Sport Club", "slug": "reflexa-sport", "description": "Main club" }
```
Expected 201 — save `organizationId`.

Verify in DB:
```sql
SELECT * FROM app.organizations WHERE slug = 'reflexa-sport';
SELECT * FROM app.organization_memberships WHERE organization_id = '<orgId>';
SELECT r.code FROM app.organization_membership_roles omr
JOIN app.roles r ON r.id = omr.role_id
WHERE omr.organization_membership_id = '<membershipId>';
-- should return ORG_ADMIN
```

### 2. List Organizations
```http
GET /api/organizations
Authorization: Bearer <accessToken>
```
Expected 200 — array containing the org just created.

### 3. Get My Access Profile
```http
GET /api/organizations/<orgId>/me
Authorization: Bearer <accessToken>
```
Expected 200 — org info + membership + roles: `["ORG_ADMIN"]` + effectivePermissions.

> **Note:** Effective permissions will be empty until `role_permissions` rows exist in DB.
> Run seed SQL that maps ORG_ADMIN → all permissions, or add manually.

### 4. Add Member
```http
POST /api/organizations/<orgId>/members
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "email": "athlete@example.com", "roleCodes": ["ATHLETE"] }
```
Expected 201.

Failure cases:
- `{ "email": "unknown@x.com" }` → 404 user not found
- Same email again → 409 already member
- `{ "roleCodes": ["INVALID"] }` → 404 unknown role code

### 5. List Members
```http
GET /api/organizations/<orgId>/members
Authorization: Bearer <accessToken>
```
Expected 200 — array of members with roles.

### 6. Assign Roles
```http
POST /api/organizations/<orgId>/members/<membershipId>/roles
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "roleCodes": ["TRAINER", "ATHLETE"] }
```
Expected 200 — `{ "assignedRoles": ["TRAINER", "ATHLETE"] }`.

### 7. Get Effective Permissions
```http
GET /api/organizations/<orgId>/members/<membershipId>/permissions
Authorization: Bearer <accessToken>
```
Expected 200 — `{ "permissions": [...] }`.

### 8. Common Failure Cases
```
POST /organizations — duplicate slug → 409
GET /organizations/<invalid-uuid>/me → 400 validation failed
POST /organizations/<orgId>/members with non-member token → 403 no users.manage permission
GET /organizations/<orgId>/members/<membershipId>/permissions as other non-admin user → 403
```

---

## Intentionally Deferred

| Item | Reason |
|------|--------|
| `role_permissions` seed data | Must be configured per deployment — not hardcoded in code |
| Team management | Next phase |
| Viewer access scope management | Future phase |
| Pagination on `GET /members` | Future enhancement |
| Membership invitation flow (INVITED status) | Future — currently adds as ACTIVE immediately |
| Remove/suspend membership endpoint | Future phase |

