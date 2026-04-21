# Reflexa — Node.js Backend

Production-grade REST API backend for the Reflexa platform.

**Stack:** Node.js · TypeScript · Express · MSSQL

---

## Project Structure

```
src/
├── app.ts                        # Express app setup
├── server.ts                     # Bootstrap: DB connect → build routes → listen
├── config/
│   ├── database.ts               # MSSQL connection pool
│   └── env.ts                    # Typed, fail-fast env variable access
├── middlewares/
│   ├── auth.middleware.ts         # JWT verification → req.user
│   └── error.middleware.ts        # Centralised error handler
├── routes/
│   └── index.ts                  # Async API router factory
├── shared/
│   ├── errors/
│   │   ├── app-error.ts          # Base AppError class
│   │   └── http-errors.ts        # ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError
│   ├── middlewares/
│   │   └── validate.middleware.ts # Zod validation middleware factory
│   ├── types/
│   │   ├── auth-user.types.ts    # AuthUser interface (attached to req.user)
│   │   └── express.d.ts          # Express Request augmentation
│   └── utils/
│       ├── crypto.utils.ts       # generateSecureToken, hashToken (SHA-256)
│       ├── password.utils.ts     # hashPassword, comparePassword (bcrypt)
│       ├── token.utils.ts        # signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, getTokenExpiry
│       └── response.ts           # sendSuccess, sendSuccessWithMessage
└── modules/
    ├── users/
    │   ├── users.types.ts        # UserRow interface (shared across modules)
    │   └── users.repository.ts   # app.users SQL access
    └── auth/
        ├── auth.types.ts         # RegisterInput, LoginInput, SafeUser, TokenPair, ...
        ├── auth.validation.ts    # Zod schemas for all auth endpoints
        ├── auth.repository.ts    # app.email_verification_tokens + app.refresh_tokens SQL
        ├── auth.mapper.ts        # UserRow → SafeUser (strips password_hash)
        ├── auth.service.ts       # All auth business logic
        ├── auth.controller.ts    # Thin HTTP handlers
        └── auth.routes.ts        # Route wiring + dependency composition
```

---

## Environment Variables

Copy the variables below into your `.env` file. Never commit `.env`.

```dotenv
# Server
PORT=3000
NODE_ENV=development

# Database (MSSQL)
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=Reflexa
DB_USER=sa
DB_PASSWORD=your_db_password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT — use `openssl rand -hex 64` to generate secrets
JWT_ACCESS_SECRET=replace_with_long_random_secret
JWT_REFRESH_SECRET=replace_with_different_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Auth
EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS=24
BCRYPT_SALT_ROUNDS=12
```

---

## Getting Started

```bash
npm install
npm run dev       # tsx watch — hot reload
npm run build     # tsc → dist/
npm start         # node dist/server.js
```

---

## Auth Endpoints

Base path: `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | public | Create account, stores email verification token |
| `POST` | `/login` | public | Validate credentials, issue JWT access + refresh tokens |
| `POST` | `/verify-email` | public | Consume email verification token, mark user verified |
| `POST` | `/refresh-token` | public | Rotate refresh token, issue new token pair |
| `POST` | `/logout` | public | Revoke the presented refresh token |
| `GET` | `/me` | `Bearer` required | Return the current authenticated user |

---

## Auth Flow

### Register
1. Validate request body (Zod).
2. Reject duplicate email.
3. Hash password with bcrypt (12 rounds).
4. Insert user row — `normalized_email` computed by DB.
5. Generate 32-byte random hex token, store in `app.email_verification_tokens` with 24 h expiry.
6. Return safe user (no `password_hash`) + message to check email.

> Email sending is **not implemented** here. The token is stored; a future email service layer handles delivery.

### Login
1. Validate request body.
2. Find user by normalised email.
3. Compare password with bcrypt — same error for "not found" and "wrong password" (prevents user enumeration).
4. Reject inactive users (`is_active = 0`) — **403**.
5. Reject unverified users (`email_verified = 0`) — **403**.
6. Sign JWT access token (15 m) and refresh token (7 d).
7. SHA-256 hash the refresh token, store hash in `app.refresh_tokens`.
8. Return safe user + token pair.

### Verify Email
1. Look up token in `app.email_verification_tokens`.
2. Reject if not found, already used (`used_at IS NOT NULL`), or expired.
3. Mark token `used_at = now`.
4. Set `users.email_verified = 1`.

### Refresh Token
1. Verify JWT signature and expiry (no DB hit).
2. SHA-256 hash the presented token, look up in `app.refresh_tokens`.
3. If not found or already revoked → **reuse attack** → revoke ALL tokens for this user → **401**.
4. Revoke old token row.
5. Issue and store new token pair.

### Logout
1. Hash the presented refresh token.
2. If found and not revoked, set `revoked_at = now`.
3. Always returns 200 — idempotent.

---

## Security Decisions

| Concern | Decision |
|---------|----------|
| Password hashing | bcrypt, 12 rounds |
| Access token lifetime | 15 minutes — limits damage if stolen |
| Refresh token storage | SHA-256 hash only — raw token never persisted |
| Refresh token rotation | Every `/refresh-token` call revokes old, issues new |
| Token reuse detection | Revoked token presented → all user sessions wiped |
| Unverified login | **Blocked** — `email_verified = 0` returns 403 |
| User enumeration | "Not found" and "wrong password" return identical 401 |
| JWT secrets | Separate secrets for access and refresh tokens |
| Sensitive fields | `password_hash` stripped by `auth.mapper.ts` before any response |

---

## Response Shape

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Success with message:**
```json
{ "success": true, "message": "...", "data": { ... } }
```

**Error:**
```json
{ "success": false, "message": "..." }
```

**Validation error (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid email address"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

---

## Database Tables Used (auth)

All tables live in the `app` schema.

| Table | Purpose |
|-------|---------|
| `app.users` | User accounts — `normalized_email` is a computed persisted column |
| `app.email_verification_tokens` | One-time tokens for email verification |
| `app.refresh_tokens` | Hashed refresh tokens with revocation support |
| `app.external_identities` | Reserved for future Google / OAuth provider linking |

---

## Architecture Rules

- **Controllers** — read request, call service, send response. No logic.
- **Services** — all business logic. Orchestrate repositories + utilities. Throw typed `AppError` subclasses.
- **Repositories** — all SQL. No HTTP concepts. Return typed results.
- **Middleware** — token verification, request validation, centralised error handling.
- **Shared utilities** — pure functions. No side effects. No HTTP imports.

---

## What Is Not Yet Implemented

- Email delivery (SMTP / SendGrid)
- Google OAuth login (schema ready: `app.external_identities`)
- Resend verification email endpoint
- Organisation / role / permission middleware
- Viewer access guards
- Offline session sync ownership

