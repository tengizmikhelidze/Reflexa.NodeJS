# Auth Foundation — Full Audit & Fix Report

Generated: 2026-04-21
Status: ✅ All fixes applied — `npx tsc --noEmit` passes with zero errors.

---

## Issues Found & Fixed

### 🔴 Critical

---

#### C1 — `verifyEmail`: wrong error types (401 for non-auth failures)

**Problem:**
`UnauthorizedError` (401) was thrown for "already used" and "expired" verification tokens.
401 means "you are not authenticated" — it has nothing to do with a token's consumed or expired state.
Client code that checks status codes would misinterpret these as auth failures.

**Correct semantics:**
- Already used → `ConflictError` (409) — a state conflict
- Expired → `ForbiddenError` (403) — token is genuine but no longer permitted

**Fix applied in:** `auth.service.ts` → `verifyEmail()`

```typescript
// Before (wrong):
throw new UnauthorizedError('Verification token has already been used.');
throw new UnauthorizedError('Verification token has expired...');

// After (correct):
throw new ConflictError('Verification token has already been used.');
throw new ForbiddenError('Verification token has expired. Please request a new one.');
```

---

#### C2 — `getMe`: did not check `is_active` after token was issued

**Problem:**
A user can be deactivated by an admin after they log in. Their access token remains valid for
15 minutes. The old `getMe` returned the user profile regardless of `is_active` status.
An inactive user could continue reading their profile (and any future protected endpoint
that uses the same pattern) until token expiry.

`findById` already excludes soft-deleted rows (`deleted_at IS NULL`), so a missing row also
covers the deleted case. The only gap was `is_active = 0` on an existing row.

**Fix applied in:** `auth.service.ts` → `getMe()`

```typescript
// Added after the null check:
if (!user.is_active) {
    throw new ForbiddenError('Your account has been deactivated. Please contact support.');
}
```

---

#### C3 — Missing `.js` extensions on relative imports (runtime failure risk)

**Problem:**
The project uses `"module": "NodeNext"` in `tsconfig.json`. Under NodeNext module resolution,
relative imports **must** include the `.js` extension even in TypeScript source files.
`tsc --noEmit` may pass but the compiled output will fail at runtime with `ERR_MODULE_NOT_FOUND`.

Affected imports:
- `http-errors.ts`: `from './app-error'`
- `error.middleware.ts`: `from '../shared/errors/app-error'` and `from '../shared/errors/http-errors'`
- `validate.middleware.ts`: `from '../errors/http-errors'`
- `users.repository.ts`: `from './users.types'`

**Fix applied:** All four files updated to use `.js` extensions.

---

### 🟡 Important

---

#### I1 — `issueTokenPair`: unused `_userId` parameter

**Problem:**
The private method signature was:
```typescript
private async issueTokenPair(_userId: string, authUser: AuthUser): Promise<TokenPair>
```
`_userId` was passed but never used — `authUser.userId` was used instead. Dead parameter,
misleading to future readers, and both call sites had to pass a redundant argument.

**Fix applied:** Parameter removed. Both call sites updated.

```typescript
// Before:
await this.issueTokenPair(user.id, { userId: user.id, ... });

// After:
await this.issueTokenPair({ userId: user.id, ... });
```

---

#### I2 — `verifyEmail`: unsafe operation order (crash between two SQL statements)

**Problem:**
The original order was:
1. `markEmailVerificationTokenUsed(id)` — token consumed
2. `markEmailVerified(user_id)` — user verified

If the server crashed between steps 1 and 2:
- The token is permanently consumed
- The user is still `email_verified = 0`
- The user cannot retry (token is used) and cannot log in — stuck permanently

**Fix applied:** Order reversed.

```typescript
// Safe order — user verified first:
await this.usersRepo.markEmailVerified(record.user_id);     // step 1
await this.authRepo.markEmailVerificationTokenUsed(record.id); // step 2
```

If crash after step 1 but before step 2: token can still be retried → user is verified → safe.
If crash after step 2 but before step 1: impossible (step 1 is now last).

> Note: A proper database transaction would make both operations fully atomic.
> This is the safest achievable order without transaction support in the current architecture.
> Tracked as a future improvement: wrap in a stored procedure or transaction when available.

---

#### I4 — `refreshToken`: no DB-level `expires_at` check

**Problem:**
Only the JWT `exp` claim was checked (via `verifyRefreshToken()`). If the DB row's `expires_at`
differs from the JWT expiry due to clock skew or manual DB edits, an expired row could pass.

**Fix applied:** Added defence-in-depth check after the revocation check.

```typescript
if (new Date() > storedToken.expires_at) {
    await this.authRepo.revokeRefreshToken(storedToken.id);
    throw new UnauthorizedError('Refresh token has expired. Please log in again.');
}
```

The expired row is also explicitly revoked to keep the DB clean.

---

### 🟢 Minor

---

#### M3 — `auth.repository.ts`: wrong comment on `tokenHash`

**Problem:**
```typescript
tokenHash: string;   // bcrypt hash of the raw refresh token  ← WRONG
```
SHA-256 is used, not bcrypt. This would mislead anyone reading the code.

**Fix applied:** Comment corrected to `// SHA-256 hex hash of the raw refresh token`.

---

## Issues Intentionally Not Fixed / Deferred

| Issue | Reason deferred |
|-------|----------------|
| M2 — `users.repository.ts` re-exports `UserRow` from both itself and `users.types.ts` | Harmless; consumers can import from either. Cleaning up import paths across all future modules is a refactor best done when those modules are built. |
| M4 — `env.ts` loads `dotenv/config` at module level | Harmless double-load. Fix belongs in a separate cleanup PR — changing it now would require removing it from `server.ts` too and verifying test environments. |
| `verifyEmail` true atomicity (transaction) | Requires either a DB transaction or stored procedure. The order-reversal fix (I2) makes the current state safe. A full transaction is a future improvement tracked separately. |

---

## Files Changed in This Audit

| File | Changes |
|------|---------|
| `src/shared/errors/http-errors.ts` | Fixed import extension (C3) |
| `src/middlewares/error.middleware.ts` | Fixed import extensions (C3) |
| `src/shared/middlewares/validate.middleware.ts` | Fixed import extension (C3) |
| `src/modules/users/users.repository.ts` | Fixed import extension (C3) |
| `src/modules/auth/auth.service.ts` | C1: verifyEmail error types; C2: getMe active check; I1: removed unused param; I2: reversed verifyEmail order; I4: added DB expires_at check |
| `src/modules/auth/auth.repository.ts` | M3: fixed wrong comment |

---

## Final Checklist

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| C1 | `verifyEmail` wrong error types (401 → 409/403) | Critical | ✅ Fixed |
| C2 | `getMe` missing `is_active` check | Critical | ✅ Fixed |
| C3 | Missing `.js` extensions on 4 imports | Critical | ✅ Fixed |
| I1 | Unused `_userId` param in `issueTokenPair` | Important | ✅ Fixed |
| I2 | Unsafe `verifyEmail` operation order | Important | ✅ Fixed |
| I4 | No DB-level `expires_at` check in `refreshToken` | Important | ✅ Fixed |
| M3 | Wrong comment on `tokenHash` (bcrypt vs SHA-256) | Minor | ✅ Fixed |
| M2 | Dual `UserRow` re-export | Minor | ⏸ Deferred |
| M4 | `dotenv` loaded twice | Minor | ⏸ Deferred |
| — | `verifyEmail` full transaction atomicity | Future | ⏸ Deferred |

