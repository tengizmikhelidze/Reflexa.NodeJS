# Reflexa API — Integration Reference

Base URL: `http://localhost:3000/api`

All requests and responses use `application/json`.
All responses follow a consistent envelope shape (see [Response Shape](#response-shape)).

---

## Table of Contents

- [Authentication](#authentication)
- [Response Shape](#response-shape)
- [Auth Endpoints](#auth-endpoints)
- [Organization Endpoints](#organization-endpoints)
- [Shared Types](#shared-types)
- [Shared Organization Types](#shared-organization-types)
- [Integration Guide](#integration-guide)
- [Health Check](#health-check)
- [Error Reference](#error-reference)

---

## Authentication

Protected endpoints (marked 🔒) require a JWT access token in the `Authorization` header:

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
| 403 | "Your account has been deactivated. Please contact support." |
| 403 | "Email address has not been verified. Please check your inbox." |

> Note: `is_active` is checked before `email_verified`. A deactivated account sees the deactivation message, not the verification prompt.

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

---

## Organization Endpoints

All organization endpoints require `Authorization: Bearer <accessToken>`.

---

### POST `/organizations` 🔒

Create a new organization. Creator automatically becomes an ACTIVE member with `ORG_ADMIN` role.

**Request body**
```typescript
{
  name: string;         // required, max 200 chars
  slug: string;         // required, lowercase letters/numbers/hyphens only, max 150
  description?: string; // optional, max 1000 chars
}
```

**Response — 201**
```typescript
{
  success: true;
  data: { organization: OrganizationSummary }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 409 | "An organization with slug '...' already exists." |

---

### GET `/organizations` 🔒

List organizations the current user belongs to (active memberships only).
Super admins receive all active organizations.

**Response — 200**
```typescript
{
  success: true;
  data: { organizations: OrganizationSummary[] }
}
```

---

### GET `/organizations/:organizationId/me` 🔒

Returns the current user's full access profile inside the organization.

**Response — 200**
```typescript
{
  success: true;
  data: {
    organization: OrganizationSummary;
    membership: MembershipSummary;
    effectivePermissions: string[];  // permission codes
  }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | organizationId is not a valid UUID |
| 403 | Not an active member |
| 404 | Organization not found |

---

### POST `/organizations/:organizationId/members` 🔒

Add an existing user to the organization by email. Requires `users.manage` permission.

**Request body**
```typescript
{
  email: string;        // required — must match an existing verified user
  roleCodes?: string[]; // optional initial roles e.g. ["ATHLETE"]
}
```

**Response — 201**
```typescript
{
  success: true;
  data: { member: MemberWithRoles }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No `users.manage` permission |
| 404 | User not found with that email |
| 404 | Unknown role codes |
| 409 | User is already a member |

---

### GET `/organizations/:organizationId/members` 🔒

List all active members with their roles. Requires `users.manage` permission.

**Response — 200**
```typescript
{
  success: true;
  data: { members: MemberWithRoles[] }
}
```

---

### POST `/organizations/:organizationId/members/:membershipId/roles` 🔒

Replace role assignments for a membership. Requires `users.manage` permission.

**Request body**
```typescript
{
  roleCodes: string[];  // required, min 1 — replaces ALL existing roles
}
```

**Response — 200**
```typescript
{
  success: true;
  data: { assignedRoles: string[] }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No `users.manage` permission or membership is inactive |
| 404 | Membership not found / unknown role codes |

---

### GET `/organizations/:organizationId/members/:membershipId/permissions` 🔒

Get effective permissions for a membership. Allowed for self OR users with `users.manage`.

**Response — 200**
```typescript
{
  success: true;
  data: {
    membershipId: string;
    userId: string;
    organizationId: string;
    permissions: string[];  // deduplicated permission codes
  }
}
```

---

## Shared Organization Types

### `OrganizationSummary`
```typescript
interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;  // ISO 8601
}
```

### `MembershipSummary`
```typescript
interface MembershipSummary {
  id: string;
  userId: string;
  status: string;     // "ACTIVE" | "INVITED" | "SUSPENDED"
  joinedAt: string;   // ISO 8601
  roles: string[];    // role codes e.g. ["ORG_ADMIN"]
}
```

### `MemberWithRoles`
```typescript
interface MemberWithRoles {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: string;
  joinedAt: string;
  roles: string[];
}
```

### Available Role Codes
| Code | Description |
|------|-------------|
| `ORG_ADMIN` | Organization administrator |
| `TRAINER` | Trainer / coach |
| `ATHLETE` | Regular athlete |
| `VIEWER` | Read-only viewer |

### Available Permission Codes
| Code | Description |
|------|-------------|
| `users.manage` | Manage organization users |
| `teams.manage` | Manage teams |
| `devices.manage` | Manage devices |
| `presets.manage` | Manage presets |
| `session.start` | Start sessions |
| `session.end` | End sessions |
| `session.delete` | Delete sessions |
| `viewer.scope.manage` | Manage viewer access scopes |

---

## Device Endpoints

All device endpoints require `Authorization: Bearer <accessToken>`.

---

### POST `/devices/kits` 🔒

Create a new device kit. Requires org-level `devices.manage` permission. Creator becomes `owner_user_id`.

**Request body**
```typescript
{
  organizationId: string;  // required — UUID of the owning organization
  name: string;            // required, max 150 chars
  code: string;            // required, unique, lowercase letters/numbers/hyphens only, max 100
  description?: string;    // optional, max 500 chars
  maxPods?: number;        // optional, default 20, max 200
}
```

**Response — 201**
```typescript
{ success: true; data: { kit: DeviceKitSummary } }
```

**Error cases**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | Not an active org member or missing `devices.manage` |
| 404 | Organization not found |
| 409 | `"A device kit with code '...' already exists."` |

---

### GET `/devices/kits` 🔒

List device kits visible to the current user (owned + shared + org-member kits).
Super admins receive all non-deleted kits.

**Response — 200**
```typescript
{ success: true; data: { kits: DeviceKitSummary[] } }
```

---

### GET `/devices/kits/:deviceKitId` 🔒

Get detailed info for a kit — includes hub and pod count. Requires view access.

**Response — 200**
```typescript
{ success: true; data: { kit: DeviceKitDetail } }
```

**Error cases**

| Status | Message |
|--------|---------|
| 400 | deviceKitId is not a valid UUID |
| 403 | No view access to this kit |
| 404 | Device kit not found |

---

### POST `/devices/kits/:deviceKitId/access` 🔒

Grant or update kit-level access for a user. If a row already exists it is updated (upsert).
Requires manage access on the kit.

**Request body**
```typescript
{
  userId: string;      // required — UUID of the user to grant access to
  canOperate: boolean; // required
  canManage: boolean;  // required
}
```

**Response — 201**
```typescript
{ success: true; data: { access: KitAccessGrant } }
```

**Error cases**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No manage access to this kit |
| 404 | Device kit not found |

---

### GET `/devices/kits/:deviceKitId/access` 🔒

List all user access grants for a kit. Requires manage access.

**Response — 200**
```typescript
{ success: true; data: { accessGrants: KitAccessGrant[] } }
```

---

### POST `/devices/kits/:deviceKitId/hub` 🔒

Register a hub for a kit. Enforces one hub per kit — returns 409 if one already exists.
Requires manage access on the kit.

**Request body**
```typescript
{
  hardwareUid: string;      // required, unique across all hubs, max 100
  serialNumber?: string;    // optional
  firmwareVersion?: string; // optional
  bluetoothName?: string;   // optional
}
```

**Response — 201**
```typescript
{ success: true; data: { hub: HubSummary } }
```

**Error cases**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No manage access |
| 404 | Device kit not found |
| 409 | `"This device kit already has a hub registered."` |
| 409 | `"A hub with hardware UID '...' is already registered to another kit."` |

---

### POST `/devices/kits/:deviceKitId/pods` 🔒

Register one or more pods to a kit. All-or-nothing — any conflict rejects the whole batch.
Requires manage access on the kit.

**Decision per pod hardware UID:**
- Not seen before → create pod + pairing history
- Exists, unassigned (`current_device_kit_id = null`) → assign + pairing history
- Exists, already in **this** kit → **409**
- Exists, in **another** kit → **409** (use `/pods/:podId/reassign` instead)

**Request body**
```typescript
{
  pods: Array<{
    hardwareUid: string;      // required, unique, max 100
    serialNumber?: string;
    firmwareVersion?: string;
    displayName?: string;
    logicalIndex?: number;    // optional slot number within kit
  }>;
}
```

**Response — 201**
```typescript
{ success: true; data: { pods: PodSummary[] } }
```

**Error cases**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No manage access |
| 404 | Device kit not found |
| 409 | Pod already assigned (here or elsewhere) |

---

### GET `/devices/kits/:deviceKitId/pods` 🔒

List active pods currently assigned to a kit. Requires view access.

**Response — 200**
```typescript
{ success: true; data: { pods: PodSummary[] } }
```

---

### POST `/devices/pods/:podId/reassign` 🔒

Explicitly move a pod from its current kit to a new kit. Deliberate audited action — not silent.
Requires manage access on **both** the source and target kits.

Closes active pairing history on source kit. Opens new pairing history on target kit.

**Request body**
```typescript
{
  targetDeviceKitId: string;  // required — UUID of the destination kit
}
```

**Response — 200**
```typescript
{ success: true; data: { pod: PodSummary } }
```

**Error cases**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No manage access on source or target kit |
| 404 | Pod not found / target kit not found |
| 409 | Pod already in target kit / pod not currently assigned |

---

## Shared Device Types

### `DeviceKitSummary`
```typescript
interface DeviceKitSummary {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  ownerUserId: string | null;
  maxPods: number;
  createdAt: string;  // ISO 8601
}
```

### `DeviceKitDetail`
```typescript
interface DeviceKitDetail extends DeviceKitSummary {
  hub: HubSummary | null;
  podCount: number;
}
```

### `HubSummary`
```typescript
interface HubSummary {
  id: string;
  hardwareUid: string;
  serialNumber: string | null;
  firmwareVersion: string | null;
  bluetoothName: string | null;
  isActive: boolean;
  lastSeenAt: string | null;  // ISO 8601
}
```

### `PodSummary`
```typescript
interface PodSummary {
  id: string;
  hardwareUid: string;
  serialNumber: string | null;
  firmwareVersion: string | null;
  currentDeviceKitId: string | null;
  displayName: string | null;
  logicalIndex: number | null;
  batteryPercent: number | null;
  batteryLevel: string | null;  // "HIGH" | "MEDIUM" | "LOW" | null
  isActive: boolean;
  lastSeenAt: string | null;  // ISO 8601
}
```

### `KitAccessGrant`
```typescript
interface KitAccessGrant {
  id: string;
  deviceKitId: string;
  userId: string;
  canOperate: boolean;
  canManage: boolean;
  grantedByUserId: string | null;
  createdAt: string;  // ISO 8601
}
```

### Device Permission Rules

| Who | Can view kits | Can manage kits |
|-----|--------------|-----------------|
| Super admin | All kits | All kits |
| Org member with `devices.manage` | All org kits | All org kits |
| Active org member (any role) | Org kits | ❌ |
| User with `can_manage = true` on kit | That kit | That kit |
| User with `can_operate = true` on kit | That kit | ❌ |

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

