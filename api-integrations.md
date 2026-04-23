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
- [Device Endpoints](#device-endpoints)
- [Session Endpoints](#session-endpoints)
- [Preset Endpoints](#preset-endpoints)
- [Team Endpoints](#team-endpoints)
- [Viewer Scope Endpoints](#viewer-scope-endpoints)
- [Shared Types](#shared-types)
- [Shared Organization Types](#shared-organization-types)
- [Shared Device Types](#shared-device-types)
- [Shared Session Types](#shared-session-types)
- [Shared Preset Types](#shared-preset-types)
- [Shared Team Types](#shared-team-types)
- [Shared Viewer Scope Types](#shared-viewer-scope-types)
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
| 404 | "Verification token is invalid." |
| 409 | "Verification token has already been used." |
| 403 | "Verification token has expired. Please request a new one." |

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
| `session.assign` | Assign sessions to users or teams |
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

## Session Endpoints

All session endpoints require `Authorization: Bearer <accessToken>`.

---

### POST `/sessions/sync` 🔒

Sync a completed offline (or online) training session. Idempotent — if the same
`(organizationId, clientSessionId)` pair already exists the existing record is returned with **200**
instead of **201** and no data is changed.

Actor must be an active member of the specified organization.

**Request body**
```typescript
{
  clientSessionId: string;       // required, max 100 — client UUID used for idempotency
  organizationId:  string;       // required, UUID
  deviceKitId:     string;       // required, UUID
  hubDeviceId?:    string;       // optional, UUID — must belong to deviceKitId

  startedByUserId?:  string;     // optional, UUID
  assignedToUserId?: string;     // optional, UUID — must be active org member
  teamId?:           string;     // optional, UUID — must belong to same org

  origin:       'OFFLINE_SYNC' | 'WEB' | 'ADMIN_CREATE';
  status:       'COMPLETED' | 'CANCELLED' | 'FAILED';
  endMode:      'TIME' | 'TARGET' | 'REPETITION' | 'EARLY_END';
  presetId?:    string;          // optional, UUID
  trainingMode: string;          // max 50 chars
  configJson:   Record<string, unknown>;

  sessionStartedAt: string;      // ISO 8601
  sessionEndedAt:   string;      // ISO 8601
  durationMs:       number;      // int, min 0

  score?:           number;      // int
  hitCount:         number;      // int, min 0
  missCount:        number;      // int, min 0
  accuracyPercent?: number;      // 0–100

  avgReactionMs?:   number;
  bestReactionMs?:  number;
  worstReactionMs?: number;

  notes?: string;                // max 1000 chars

  activePods?: Array<{
    podDeviceId: string;         // UUID — must belong to deviceKitId
    podOrder?:   number;         // int, min 0
  }>;

  events?: Array<{
    podDeviceId?:    string;     // UUID
    eventIndex:      number;     // int, min 0 — unique per session
    eventType:       string;     // max 50 chars
    eventTimestamp:  string;     // ISO 8601
    elapsedMs?:      number;     // int, min 0
    reactionTimeMs?: number;
    isCorrect?:      boolean;
    payloadJson?:    Record<string, unknown>;
  }>;
}
```

**Response — 201 (new) / 200 (duplicate)**
```typescript
{
  success: true;
  data: { session: SessionSummary }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | Not an active member of the organization |
| 404 | Organization not found / hub not in kit / pod not in kit / assigned user not org member / team not in org |

---

### GET `/sessions` 🔒

List non-deleted sessions. Supports query filters.

Regular users **must** supply `organizationId` and must be an active member of that org.
Super admins may omit `organizationId` to receive all sessions.

**Query parameters**
```
?organizationId=<uuid>       required for non-super-admins
?assignedToUserId=<uuid>     optional filter
?teamId=<uuid>               optional filter
```

**Response — 200**
```typescript
{
  success: true;
  data: { sessions: SessionSummary[] }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 403 | `organizationId` not provided (non-super-admin) |
| 403 | Not an active member of the organization |

---

### GET `/sessions/:sessionId` 🔒

Get full session detail including active pods and all events. Actor must be an active org member.

**Path params**
```
sessionId  UUID
```

**Response — 200**
```typescript
{
  success: true;
  data: { session: SessionDetail }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | sessionId is not a valid UUID |
| 403 | Not an active member of the session's organization |
| 404 | Session not found |

---

### PATCH `/sessions/:sessionId/assign` 🔒

Update the assignment (user and/or team) of a session.
Requires `session.assign` permission on the session's organization.

**Path params**
```
sessionId  UUID
```

**Request body**
```typescript
{
  assignedToUserId?: string | null;  // UUID or null to clear
  teamId?:           string | null;  // UUID or null to clear
}
```

**Response — 200**
```typescript
{
  success: true;
  data: { session: SessionSummary }
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | sessionId is not a valid UUID or body validation failed |
| 403 | Not an active member or missing `session.assign` permission |
| 404 | Session not found / assigned user not active org member / team not in org |

---

### DELETE `/sessions/:sessionId` 🔒

Soft-delete a session and write an audit log entry. Idempotent — deleting an already-deleted
session returns 200 with no error.
Requires `session.delete` permission on the session's organization.

**Path params**
```
sessionId  UUID
```

**Response — 200**
```typescript
{
  success: true;
  message: "Session deleted.";
  data: null;
}
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | sessionId is not a valid UUID |
| 403 | Not an active member or missing `session.delete` permission |

---

## Shared Session Types

### `SessionSummary`
```typescript
interface SessionSummary {
  id: string;
  organizationId: string;
  deviceKitId: string;
  hubDeviceId: string | null;

  startedByUserId:  string | null;
  assignedToUserId: string | null;
  assignedByUserId: string | null;
  teamId:           string | null;

  origin:          string;   // "OFFLINE_SYNC" | "WEB" | "ADMIN_CREATE"
  syncStatus:      string;
  clientSessionId: string | null;

  status:       string;   // "COMPLETED" | "CANCELLED" | "FAILED"
  endMode:      string;   // "TIME" | "TARGET" | "REPETITION" | "EARLY_END"
  presetId:     string | null;
  trainingMode: string;

  sessionStartedAt: string;  // ISO 8601
  sessionEndedAt:   string;  // ISO 8601
  durationMs:       number;

  score:           number | null;
  hitCount:        number;
  missCount:       number;
  accuracyPercent: number | null;

  avgReactionMs:   number | null;
  bestReactionMs:  number | null;
  worstReactionMs: number | null;

  activePodCount:   number;
  totalEventsCount: number;
  notes:            string | null;

  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

### `SessionDetail`
Extends `SessionSummary` with full config and event data.

```typescript
interface SessionDetail extends SessionSummary {
  configJson: Record<string, unknown>;
  activePods: Array<{
    id:          string;
    podDeviceId: string;
    podOrder:    number | null;
  }>;
  events: Array<{
    id:             string;
    podDeviceId:    string | null;
    eventIndex:     number;
    eventType:      string;
    eventTimestamp: string;  // ISO 8601
    elapsedMs:      number | null;
    reactionTimeMs: number | null;
    isCorrect:      boolean | null;
    payloadJson:    Record<string, unknown> | null;
  }>;
}
```

### Session Access Rules

| Who | Can sync | Can view | Can assign | Can delete |
|-----|----------|----------|------------|------------|
| Super admin | ✅ | ✅ (all) | ✅ | ✅ |
| Active org member | ✅ | ✅ (org sessions) | Requires `session.assign` | Requires `session.delete` |
| Non-member | ❌ | ❌ | ❌ | ❌ |

---

## Preset Endpoints

All preset endpoints require `Authorization: Bearer <accessToken>`.

---

### POST `/presets` 🔒

Create a preset. Supports both `USER` (personal) and `ORGANIZATION` scopes.
For `ORGANIZATION` scope, actor must be an active org member with `presets.manage`.

**Request body**
```typescript
{
  scope:           'USER' | 'ORGANIZATION';
  organizationId?: string;   // required when scope = ORGANIZATION
  name:            string;   // max 150 chars
  description?:    string;   // max 500 chars
  configJson:      Record<string, unknown>;
}
```

**Response — 201**
```typescript
{ success: true; data: { preset: PresetDetail } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed / organizationId required for ORGANIZATION scope |
| 403 | Not an active org member or missing `presets.manage` |

---

### GET `/presets` 🔒

List presets visible to the actor:
- Own personal (`USER`) presets
- Org presets from orgs the actor is an **active member** of

Super admins see all non-deleted presets.

**Query parameters**
```
?scope=USER|ORGANIZATION     optional filter
?organizationId=<uuid>       optional filter
?createdByUserId=<uuid>      optional filter
```

**Response — 200**
```typescript
{ success: true; data: { presets: PresetSummary[] } }
```

---

### GET `/presets/:presetId` 🔒

Get preset detail (includes `configJson`). Access rules:
- `USER` scope: owner only
- `ORGANIZATION` scope: any active org member

**Response — 200**
```typescript
{ success: true; data: { preset: PresetDetail } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | presetId is not a valid UUID |
| 403 | No access to this preset |
| 404 | Preset not found |

---

### PATCH `/presets/:presetId` 🔒

Update a preset's `name`, `description`, and/or `configJson`. At least one field required.
- `USER` scope: owner only
- `ORGANIZATION` scope: requires `presets.manage`

**Request body**
```typescript
{
  name?:        string;                      // max 150 chars
  description?: string | null;              // null to clear
  configJson?:  Record<string, unknown>;
}
```

**Response — 200**
```typescript
{ success: true; data: { preset: PresetDetail } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | No write access to this preset |
| 404 | Preset not found |

---

### DELETE `/presets/:presetId` 🔒

Soft-delete a preset. Idempotent — deleting an already-deleted preset returns 200.
- `USER` scope: owner only
- `ORGANIZATION` scope: requires `presets.manage`

**Response — 200**
```typescript
{ success: true; data: null }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | presetId is not a valid UUID |
| 403 | No write access to this preset |

---

## Shared Preset Types

### `PresetSummary`
```typescript
interface PresetSummary {
  id:              string;
  organizationId:  string | null;  // null for USER scope
  createdByUserId: string;
  scope:           'USER' | 'ORGANIZATION';
  name:            string;
  description:     string | null;
  createdAt:       string;  // ISO 8601
  updatedAt:       string;  // ISO 8601
}
```

### `PresetDetail`
Extends `PresetSummary` with parsed config.

```typescript
interface PresetDetail extends PresetSummary {
  configJson: Record<string, unknown>;
}
```

### Preset Access Rules

| Who | Can read USER preset | Can read ORG preset | Can write USER preset | Can write ORG preset |
|-----|---------------------|---------------------|-----------------------|----------------------|
| Super admin | ✅ | ✅ | ✅ | ✅ |
| Owner | ✅ | — | ✅ | — |
| Active org member | — | ✅ | — | Requires `presets.manage` |

---

## Team Endpoints

All team endpoints require `Authorization: Bearer <accessToken>`.

---

### POST `/teams` 🔒

Create a team within an organization. Requires `teams.manage` permission.
Team names must be unique within the organization.

**Request body**
```typescript
{
  organizationId: string;   // required, UUID
  name:           string;   // required, max 150 — unique per org
  description?:   string;   // optional, max 500
}
```

**Response — 201**
```typescript
{ success: true; data: { team: TeamDetail } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | Not an active org member or missing `teams.manage` |
| 409 | A team with this name already exists in the organization |

---

### GET `/teams` 🔒

List teams. Regular users see teams from orgs they are active members of.
Super admins see all non-deleted teams.

**Query parameters**
```
?organizationId=<uuid>   optional filter
```

**Response — 200**
```typescript
{ success: true; data: { teams: TeamSummary[] } }
```

---

### GET `/teams/:teamId` 🔒

Get team detail including member count. Actor must be an active member of the team's org.

**Response — 200**
```typescript
{ success: true; data: { team: TeamDetail } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | teamId is not a valid UUID |
| 403 | Not an active member of the organization |
| 404 | Team not found |

---

### POST `/teams/:teamId/members` 🔒

Add a user to a team. Requires `teams.manage`. The user must be an active member of the team's organization.

**Request body**
```typescript
{
  userId: string;  // required, UUID — must be an active org member
}
```

**Response — 201**
```typescript
{ success: true; data: { members: TeamMemberSummary[] } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | Missing `teams.manage` permission |
| 404 | Team not found / user is not an active org member |
| 409 | User is already a member of the team |

---

### GET `/teams/:teamId/members` 🔒

List team members with user details. Actor must be an active org member.

**Response — 200**
```typescript
{ success: true; data: { members: TeamMemberSummary[] } }
```

---

### DELETE `/teams/:teamId/members/:userId` 🔒

Remove a user from a team. Requires `teams.manage`. Idempotent — removing a non-member silently succeeds.
This only removes the team membership, not the organization membership.

**Response — 200**
```typescript
{ success: true; data: null }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | teamId or userId is not a valid UUID |
| 403 | Missing `teams.manage` permission |
| 404 | Team not found |

---

## Shared Team Types

### `TeamSummary`
```typescript
interface TeamSummary {
  id:             string;
  organizationId: string;
  name:           string;
  description:    string | null;
  createdAt:      string;  // ISO 8601
  updatedAt:      string;  // ISO 8601
}
```

### `TeamDetail`
```typescript
interface TeamDetail extends TeamSummary {
  memberCount: number;
}
```

### `TeamMemberSummary`
```typescript
interface TeamMemberSummary {
  id:          string;  // team_membership id
  teamId:      string;
  userId:      string;
  email:       string;
  firstName:   string | null;
  lastName:    string | null;
  displayName: string | null;
  joinedAt:    string;  // ISO 8601
}
```

---

## Viewer Scope Endpoints

All viewer scope endpoints require `Authorization: Bearer <accessToken>`.

> **Schema note:** The current schema (`app.viewer_access_scopes`) supports only
> **user-level** visibility (`viewer_user_id → target_user_id`).
> Team-scoped visibility is **not** supported by the current schema.

---

### POST `/viewer-scopes` 🔒

Grant a viewer user visibility to a target user's data. Requires `viewer.scope.manage`.
Both viewer and target must be active members of the specified organization.
Granting the same `(org, viewer, target)` pair twice returns **409**.

**Request body**
```typescript
{
  organizationId: string;   // required, UUID
  viewerUserId:   string;   // required, UUID — must be active org member
  targetUserId:   string;   // required, UUID — must be active org member, != viewerUserId
}
```

**Response — 201**
```typescript
{ success: true; data: { scope: ViewerScopeSummary } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | Validation failed / viewerUserId equals targetUserId |
| 403 | Missing `viewer.scope.manage` permission |
| 404 | Viewer or target user is not an active org member |
| 409 | Viewer already has access to this target user |

---

### GET `/viewer-scopes` 🔒

List viewer scopes. Requires `viewer.scope.manage`.
Regular users must supply `organizationId`.
Super admins may omit it to see all scopes.

**Query parameters**
```
?organizationId=<uuid>    required for non-super-admins
?viewerUserId=<uuid>      optional filter
```

**Response — 200**
```typescript
{ success: true; data: { scopes: ViewerScopeSummary[] } }
```

**Error cases**
| Status | Message |
|--------|---------|
| 403 | organizationId not provided (non-super-admin) / missing `viewer.scope.manage` |

---

### DELETE `/viewer-scopes/:scopeId` 🔒

Revoke a viewer access scope. Requires `viewer.scope.manage` on the scope's organization.
Idempotent — revoking an already-deleted scope silently succeeds.

**Response — 200**
```typescript
{ success: true; data: null }
```

**Error cases**
| Status | Message |
|--------|---------|
| 400 | scopeId is not a valid UUID |
| 403 | Missing `viewer.scope.manage` permission |

---

## Shared Viewer Scope Types

### `ViewerScopeSummary`
```typescript
interface ViewerScopeSummary {
  id:              string;
  organizationId:  string;
  viewerUserId:    string;
  targetUserId:    string;
  grantedByUserId: string | null;
  createdAt:       string;  // ISO 8601
}
```

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

