# Reflexa API — Integration Reference

Base URL: `http://localhost:3000/api`

All requests and responses use `application/json`.  
All responses follow a consistent envelope shape (see [Response Shape](#response-shape)).

---

## Authentication

Protected endpoints require a JWT access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use `POST /auth/refresh-token` to obtain a new pair before expiry.

---

## Response Shape

### Success
```json
{
  "success": true,
  "data": { }
}
```

### Success with message
```json
{
  "success": true,
  "message": "Human-readable message.",
  "data": { }
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error."
}
```

### Validation error — 400
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "fieldName": ["Error message"]
  }
}
```

---

## Auth Endpoints

### POST `/auth/register`

Create a new user account. Returns the created user and a message to verify email.  
**No tokens are issued** — the user must verify their email before logging in.

**Request body**
```typescript
{
  email: string;         // required, valid email
  password: string;      // required, min 8 chars, 1 uppercase, 1 number
  firstName?: string;    // optional, max 100 chars
  lastName?: string;     // optional, max 100 chars
  displayName?: string;  // optional, max 200 chars
}
```

**Response — 201**
```typescript
{
  success: true;
  message: "Registration successful. Please check your email to verify your account.";
  data: {
    user: SafeUser;
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed (field errors in `errors` object) |
| 409 | "An account with this email already exists." |

---

### POST `/auth/login`

Authenticate with email and password. Issues a JWT access + refresh token pair.

> **Requires email to be verified.** Unverified accounts receive a 403.

**Request body**
```typescript
{
  email: string;     // required
  password: string;  // required
}
```

**Response — 200**
```typescript
{
  success: true;
  data: {
    user: SafeUser;
    tokens: TokenPair;
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 401 | "Invalid email or password." |
| 403 | "Email address has not been verified. Please check your inbox." |
| 403 | "Your account has been deactivated. Please contact support." |

---

### POST `/auth/verify-email`

Consume a one-time email verification token. Marks the user as verified.

**Request body**
```typescript
{
  token: string;  // required — the token from the verification email
}
```

**Response — 200**
```typescript
{
  success: true;
  data: {
    message: "Email verified successfully.";
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 401 | "Verification token has already been used." |
| 401 | "Verification token has expired. Please request a new one." |
| 404 | "Verification token is invalid." |

---

### POST `/auth/refresh-token`

Exchange a valid refresh token for a new access + refresh token pair. The old refresh token is revoked (rotation).

> If a revoked token is presented, all sessions for that user are invalidated (reuse attack detection).

**Request body**
```typescript
{
  refreshToken: string;  // required — the current refresh token
}
```

**Response — 200**
```typescript
{
  success: true;
  data: {
    tokens: TokenPair;
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 401 | "Refresh token is invalid or expired." |
| 401 | "Refresh token not recognised. All sessions have been invalidated." |
| 401 | "Refresh token has been revoked. All sessions have been invalidated." |
| 403 | "Account is inactive." |

---

### POST `/auth/logout`

Revoke the current session's refresh token. Other sessions (other devices) remain active.  
Always returns 200 — safe to call even if the token is already revoked.

**Request body**
```typescript
{
  refreshToken: string;  // required
}
```

**Response — 200**
```typescript
{
  success: true;
  data: {
    message: "Logged out successfully.";
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |

---

### GET `/auth/me` 🔒

Returns the authenticated user's profile. Requires a valid access token.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Response — 200**
```typescript
{
  success: true;
  data: {
    user: SafeUser;
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 401 | "Authorization header is missing or malformed." |
| 401 | "Access token is invalid or expired." |
| 404 | "User not found." |

---

## Shared Types

### `SafeUser`
Returned by register, login, and GET /me. Never contains `password_hash`.

```typescript
interface SafeUser {
  id: string;                 // UUID
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  createdAt: string;          // ISO 8601 UTC datetime
}
```

### `TokenPair`
Returned by login and refresh-token.

```typescript
interface TokenPair {
  accessToken: string;   // JWT, expires in 15 m
  refreshToken: string;  // JWT, expires in 7 d — store securely, never in localStorage
}
```

---

## Integration Guide

### Typical client flow

```
1. POST /auth/register          → store nothing, prompt user to check email
2. POST /auth/verify-email      → (user clicks link) → email is now verified
3. POST /auth/login             → store accessToken + refreshToken securely
4. GET  /auth/me                → verify identity on app load
5. (on 401 from any endpoint)  → POST /auth/refresh-token → retry original request
6. POST /auth/logout            → discard stored tokens
```

### Token storage recommendations

| Environment | Recommended storage |
|-------------|---------------------|
| Web (SPA) | `accessToken` in memory; `refreshToken` in `HttpOnly` cookie |
| Mobile | Secure keychain / keystore |
| Server-to-server | Environment variable or secrets manager |

> **Never store tokens in `localStorage`** — vulnerable to XSS.

### Proactive token refresh

Access tokens expire in 15 minutes. Recommended approach:
- Decode the `accessToken` JWT client-side (no verification needed — just read `exp`).
- Schedule a refresh call ~1 minute before expiry.
- On any `401` response, attempt one refresh, then retry. If refresh also fails, redirect to login.

### Email verification token

The token is currently stored in the database only — **no email is sent yet**. During development, retrieve it directly:

```sql
SELECT token
FROM app.email_verification_tokens
WHERE user_id = '<userId>'
  AND used_at IS NULL
ORDER BY created_at DESC;
```

Pass this token to `POST /auth/verify-email` to complete verification.

---

## Health Check

### GET `/health` — public

```typescript
// Response — 200
{
  status: "ok";
  timestamp: string;  // ISO 8601
}
```

---

## Error Reference

| HTTP Status | Class | Typical cause |
|-------------|-------|---------------|
| 400 | `ValidationError` | Missing or invalid request fields |
| 401 | `UnauthorizedError` | Missing/invalid/expired token, bad credentials |
| 403 | `ForbiddenError` | Valid identity but action not permitted (unverified, inactive) |
| 404 | `NotFoundError` | Resource does not exist |
| 409 | `ConflictError` | Duplicate resource (email already registered) |
| 500 | (unhandled) | Unexpected server error — details logged server-side only |

