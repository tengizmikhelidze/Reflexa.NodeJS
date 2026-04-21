# Skill 06 — Auth and Middleware

---

## authMiddleware

Located at `src/middlewares/auth.middleware.ts`.

**What it does:**
1. Reads `Authorization` header — expects `Bearer <token>` format.
2. If missing or malformed → `next(UnauthorizedError)`.
3. Calls `verifyAccessToken(token)` — throws on invalid/expired JWT.
4. If invalid/expired → `next(UnauthorizedError)`.
5. Attaches `req.user: AuthUser` with `{ userId, email, emailVerified, isSuperAdmin }`.
6. Calls `next()`.

**No DB access. No business logic. One job: verify token and attach identity.**

---

## req.user Type

Defined in `src/shared/types/auth-user.types.ts`:

```typescript
export interface AuthUser {
    userId: string;        // from JWT subject claim (payload.sub)
    email: string;
    emailVerified: boolean;
    isSuperAdmin: boolean;
}
```

Augmented onto Express `Request` in `src/shared/types/express.d.ts`:

```typescript
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;   // undefined on public routes
        }
    }
}
```

---

## Applying authMiddleware

### Protect all routes in a module

```typescript
const router = Router();
router.use(authMiddleware);   // ← applies to all routes below
router.get('/', controller.list);
router.post('/', validate(schema), controller.create);
```

### Protect individual routes

```typescript
router.get('/me', authMiddleware, controller.getMe);
router.get('/public', controller.publicHandler);   // no auth
```

---

## Accessing req.user in Controllers

Always guard — TypeScript requires it because `user` is `AuthUser | undefined`:

```typescript
create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) return next(new UnauthorizedError());
        // req.user is now AuthUser — safe to access
        const result = await this.service.create(req.body, req.user);
        sendSuccess(res, result, 201);
    } catch (err) { next(err); }
};
```

The guard is defensive — in practice `authMiddleware` always runs before protected handlers.
But `req.user` is typed as optional everywhere, so the guard is required by TypeScript.

---

## Routes That Do NOT Use authMiddleware

| Route | Reason |
|-------|--------|
| `POST /auth/register` | Public |
| `POST /auth/login` | Public — issues tokens |
| `POST /auth/verify-email` | Public — consumes one-time token |
| `POST /auth/refresh-token` | Uses refresh token, not access token — access may be expired |
| `POST /auth/logout` | Uses refresh token to revoke session |

`/refresh-token` and `/logout` must NOT use `authMiddleware` — the access token may be
expired, which is the exact reason a refresh is being requested.

---

## Token Strategy Summary

| Token | Lifetime | Secret | Storage | Validation |
|-------|----------|--------|---------|------------|
| Access token | 15m | `JWT_ACCESS_SECRET` | Client memory | Signature + expiry — no DB |
| Refresh token | 7d | `JWT_REFRESH_SECRET` | SHA-256 hash in `app.refresh_tokens` | Signature + DB hash lookup |
| Email verification | 24h | n/a (random hex) | Plain in `app.email_verification_tokens` | Token string match + expiry + used_at |

---

## Token Utilities

Located at `src/shared/utils/`:

```typescript
// token.utils.ts
signAccessToken(user: AuthUser): string
signRefreshToken(user: AuthUser): string
verifyAccessToken(token: string): JwtPayload   // throws on invalid/expired
verifyRefreshToken(token: string): JwtPayload  // throws on invalid/expired
getTokenExpiry(token: string): Date            // decode exp without verifying

// crypto.utils.ts
generateSecureToken(bytes?: number): string   // 32 bytes = 64 char hex
hashToken(value: string): string              // SHA-256 hex — deterministic

// password.utils.ts
hashPassword(plain: string): Promise<string>
comparePassword(plain: string, hash: string): Promise<boolean>
```

---

## Refresh Token Rotation (reuse attack detection)

```
Client sends refresh token
      ↓
verifyRefreshToken() — JWT signature check (no DB)
      ↓
SHA-256 hash the token
      ↓
findRefreshTokenByHash() — DB lookup
      ↓
Not found?     → revokeAllRefreshTokensForUser() → UnauthorizedError (possible replay)
Revoked?       → revokeAllRefreshTokensForUser() → UnauthorizedError (replay attack confirmed)
Expired?       → revokeRefreshToken() → UnauthorizedError
Valid?         → revokeRefreshToken(old) → issueTokenPair(new) → return new pair
```

**If a revoked token is presented, ALL sessions for that user are wiped.**
This forces re-login and prevents the attacker from maintaining access.

---

## Future Middleware Pattern (role/permission guards)

`authMiddleware` attaches identity only. Future role/permission guards stack after it:

```typescript
router.get('/admin',
    authMiddleware,                        // ← identity
    requirePermission('users.manage'),     // ← permission check (not yet implemented)
    controller.adminAction
);
```

The `OrganizationsService.requirePermission()` is the current organization-scoped version.
See `07-permissions-pattern.md` for usage.

