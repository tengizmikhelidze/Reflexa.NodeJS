# Skill 07 — Permissions Pattern

Organization-scoped permission system. All checks go through the service layer.

---

## How Permissions Work

Effective permissions for a user inside an org = **role-based UNION direct grants**.

```
user → membership → membership_roles → role_permissions → permissions (codes)
user → user_permission_grants → permissions (codes)
                                         ↓
                              UNION + DISTINCT = effective permissions
```

SQL (from `organizations.repository.ts → findEffectivePermissions`):

```sql
SELECT DISTINCT p.code
FROM app.organization_memberships om
INNER JOIN app.organization_membership_roles omr ON omr.organization_membership_id = om.id
INNER JOIN app.role_permissions rp ON rp.role_id = omr.role_id
INNER JOIN app.permissions p ON p.id = rp.permission_id
WHERE om.organization_id = @organizationId
  AND om.user_id = @userId
  AND om.status = N'ACTIVE'
  AND om.left_at IS NULL

UNION

SELECT DISTINCT p.code
FROM app.user_permission_grants upg
INNER JOIN app.permissions p ON p.id = upg.permission_id
WHERE upg.organization_id = @organizationId
  AND upg.user_id = @userId
```

---

## Active Membership Invariant

**Both conditions must be true** for a membership to count as active:

```typescript
membership.status === 'ACTIVE' && membership.left_at === null
```

Checking only `status` is a bug — `left_at` could be set while status wasn't updated.
Checking only `left_at` is a bug — status could be SUSPENDED with no left_at.

---

## requirePermission() — Organization-Scoped Check

Located in `OrganizationsService`. Called from any service that needs to protect an action.

```typescript
await this.orgsService.requirePermission(organizationId, actor, 'users.manage');
```

**Logic:**
1. If `actor.isSuperAdmin` → return immediately (bypass all org checks).
2. Find actor's membership in the org → if not active → `ForbiddenError`.
3. Get effective permissions → if permission code not in list → `ForbiddenError`.

---

## Available Permission Codes

| Code | Description |
|------|-------------|
| `users.manage` | Add/remove members, assign roles |
| `teams.manage` | Create/manage teams |
| `devices.manage` | Manage kits, hubs, pods |
| `presets.manage` | Manage organization presets |
| `session.start` | Start sessions |
| `session.end` | End sessions |
| `session.assign` | Assign sessions to users or teams |
| `session.delete` | Delete sessions |
| `viewer.scope.manage` | Assign viewer access scopes |

---

## Role Codes (seeded in DB)

| Code | Typical use |
|------|-------------|
| `ORG_ADMIN` | Full org management |
| `TRAINER` | Session management, team access |
| `ATHLETE` | Participate in sessions |
| `VIEWER` | Read-only restricted access |
| `SUPER_ADMIN` | Global platform admin (from `users.is_super_admin`, not a membership role) |

Roles are stored in `app.roles`. Role-permission mappings are in `app.role_permissions`.
These must be seeded via `database/queries/10.seed_esential_roles_and_perms.sql`.

---

## Super Admin Bypass Rules

| Action | Super admin behavior |
|--------|---------------------|
| `requirePermission(...)` | Always passes — no DB check |
| `GET /organizations` | Returns ALL active orgs |
| `GET /organizations/:id/me` | Must have an active membership — no bypass |
| `GET .../permissions` | Can view any membership's permissions |
| Write operations (add member, assign roles) | No membership required — permission bypassed |

Super admin bypass is **always** via `actor.isSuperAdmin` from `req.user` — never inferred from DB state.

---

## Self-Access Pattern

Some endpoints allow users to access their own data without `users.manage`:

```typescript
// GET /organizations/:orgId/members/:membershipId/permissions
const isSelf = membership.user_id === actor.userId;
if (!isSelf && !actor.isSuperAdmin) {
    await this.requirePermission(organizationId, actor, 'users.manage');
}
```

Pattern: `isSelf OR isSuperAdmin OR hasPermission`.
Never skip the `isSuperAdmin` check in self-access logic — super admins may not be members.

---

## Adding a New Permission-Protected Endpoint

1. Confirm the permission code exists in `app.permissions` (check seed file).
2. In the service method:

```typescript
async doProtectedAction(orgId: string, ..., actor: AuthUser) {
    await this.requireActiveOrg(orgId);
    await this.requirePermission(orgId, actor, 'teams.manage');  // ← permission code here
    // ... business logic
}
```

3. In the route: `authMiddleware` is sufficient — permission is enforced in the service.
4. Do NOT add permission checks in controllers or route middleware.

---

## DB Tables Involved

| Table | Purpose |
|-------|---------|
| `app.roles` | Role definitions (code + name) |
| `app.permissions` | Permission definitions (code + name) |
| `app.role_permissions` | Many-to-many: which roles grant which permissions |
| `app.organization_memberships` | User ↔ org relationship (status, joined_at, left_at) |
| `app.organization_membership_roles` | Many-to-many: which roles a membership has |
| `app.user_permission_grants` | Direct per-user permission grants (bypasses role system) |
| `app.device_kit_user_access` | Kit-level access grants: can_operate, can_manage |

---

## Device Kit Access Model (Devices Module)

Device kits have a secondary, kit-scoped access layer on top of org permissions.

```
Can MANAGE a kit (hub, pods, access, reassign):
  actor.isSuperAdmin                           → YES
  org-level devices.manage                     → YES (all kits in that org)
  device_kit_user_access.can_manage = true     → YES (that kit only)

Can VIEW a kit (list, detail, pods):
  actor.isSuperAdmin                           → YES
  org-level devices.manage                     → YES
  active org membership (any role)             → YES (org's kits)
  device_kit_user_access.can_operate = true    → YES (that kit only)
  device_kit_user_access.can_manage  = true    → YES (that kit only)
```

Access helpers live in `devices.service.ts` — NOT route middleware — because they need the loaded kit object:

```typescript
// In DevicesService
private async requireKitManageAccess(kit: DeviceKitRow, actor: AuthUser): Promise<void>
private async requireKitViewAccess(kit: DeviceKitRow, actor: AuthUser): Promise<void>
private async checkOrgPermission(orgId, userId, code): Promise<boolean>  // non-throwing
private async requireOrgPermission(orgId, actor, code): Promise<void>    // throws
```

Never do kit access checks in controllers or route middleware.


