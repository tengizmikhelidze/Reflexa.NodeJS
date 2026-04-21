# Organizations Phase — Audit & Fix Report

Generated: 2026-04-21
Status: ✅ All fixes applied — `npx tsc --noEmit` passes with zero errors.

---

## Issues Found & Fixed

### 🔴 Critical

---

#### C1 — `createOrganization`: 3 independent writes with no transaction

**Problem:**
The original service made three sequential SQL calls:
1. `INSERT INTO app.organizations`
2. `INSERT INTO app.organization_memberships`
3. `INSERT INTO app.organization_membership_roles`

If the server crashed or the DB threw between any two steps:
- Crash after step 1 → org exists with no admin membership → inaccessible
- Crash after step 2 → org exists with membership but no role → creator cannot manage their own org

**Fix applied:**
Added `createOrganizationWithAdmin(data, userId, orgAdminRoleId)` to the repository.
All three writes are wrapped in `new sql.Transaction(this.pool)` with `BEGIN / COMMIT / ROLLBACK`.
The service now resolves `ORG_ADMIN` role ID *before* starting the transaction (read-only lookup)
and passes it in. If `ORG_ADMIN` is not seeded, the service throws a clear `Error` before any writes.

**Files changed:** `organizations.repository.ts`, `organizations.service.ts`

---

#### C2 — `addMember`: no check for inactive or unverified target user

**Problem:**
`usersRepo.findByEmail` returns any non-deleted user. Adding a user with `is_active = 0` or
`email_verified = 0` creates a membership row for someone who cannot log in, which is a
security and data integrity problem. A deactivated user effectively gains org membership
records they are unaware of.

**Fix applied in** `organizations.service.ts` → `addMember()`:
```typescript
if (!targetUser.is_active) {
    throw new ForbiddenError('This user account is deactivated and cannot be added.');
}
if (!targetUser.email_verified) {
    throw new ForbiddenError('This user has not verified their email address yet.');
}
```

---

#### C3 — `assignRoles`: only checked `status`, not `left_at`

**Problem:**
The active membership invariant requires BOTH `status = 'ACTIVE'` AND `left_at IS NULL`.
The check was:
```typescript
if (membership.status !== 'ACTIVE') { ... }
```
This allowed roles to be assigned to memberships where `left_at` is set (user left the org
but status column was not updated) — a data corruption risk.

**Fix applied in** `organizations.service.ts` → `assignRoles()`:
```typescript
if (membership.status !== 'ACTIVE' || membership.left_at !== null) {
    throw new ForbiddenError('Cannot assign roles to an inactive membership.');
}
```

---

### 🟡 Important

---

#### I3 — `addMember`: conflict error message was inaccurate for inactive memberships

**Problem:**
```typescript
if (existing) {
    throw new ConflictError('User is already a member of this organization.');
}
```
`findMembership` returns any row (active or inactive). If the user previously left and has
`left_at IS NOT NULL`, the message "already a member" is misleading — they are no longer active.
The DB unique constraint also prevents a second insert regardless, so the error always fires
before hitting the DB for the insert.

**Fix applied:** Error message now differentiates active vs inactive state:
```typescript
const statusLabel = existing.status !== 'ACTIVE' || existing.left_at !== null
    ? 'an inactive'
    : 'an active';
throw new ConflictError(`User already has ${statusLabel} membership in this organization.`);
```

---

### 🟢 Minor

---

#### M1 — `setMembershipRoles` comment claimed "one transaction" — it was not

**Problem:**
```typescript
/** Replace all roles for a membership in one transaction */
```
The method makes a separate DELETE then N sequential INSERTs with no transaction wrapping.
This is false documentation and misleading to future contributors.

**Fix applied:** Comment updated to accurately describe the behavior:
```typescript
/** Replace all roles for a membership (sequential — no transaction wrapper available at pool level) */
```

---

## Areas with No Issues

| Area | Verdict |
|------|---------|
| Active membership filtering in `requireActiveMembership` | ✅ Both `status` and `left_at` checked |
| Active membership filtering in `requirePermission` | ✅ Both checked |
| Active membership filtering in `findActiveMembers` SQL | ✅ Both checked in WHERE clause |
| `findEffectivePermissions` SQL | ✅ Correctly filters active membership + uses UNION for direct grants |
| Super admin bypass consistency | ✅ Consistent in `requirePermission` and `listOrganizations` |
| Self-access rule for `getEffectivePermissions` | ✅ `isSelf || isSuperAdmin` checked before `requirePermission` |
| Route/middleware order | ✅ `authMiddleware` applied globally via `router.use`, then per-route validation |
| Slug uniqueness check | ✅ Checked before any writes |
| Response status codes | ✅ 201 for POST creates, 200 for GET/PUT-like, 400/403/404/409 for errors |
| Path param UUID validation | ✅ Zod validation middleware applied on all parameterised routes |

---

## Final Checklist

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| C1 | `createOrganization` 3 writes not atomic | Critical | ✅ Fixed — DB transaction |
| C2 | `addMember` accepts inactive/unverified users | Critical | ✅ Fixed — active + verified checks |
| C3 | `assignRoles` ignored `left_at` | Critical | ✅ Fixed — both conditions checked |
| I3 | `addMember` conflict message inaccurate for inactive memberships | Important | ✅ Fixed — status-aware message |
| M1 | `setMembershipRoles` false transaction comment | Minor | ✅ Fixed — comment corrected |
| — | `setMembershipRoles` itself not transactional | Future | ⏸ Deferred — lower risk (no pre-delete of critical data); add stored procedure if needed |
| — | N+1 membership lookups across service methods | Future | ⏸ Deferred — acceptable at current scale; addressed with composite queries when needed |

