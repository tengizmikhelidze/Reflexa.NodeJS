# GitHub Copilot Instructions — Reflexa Angular Frontend

This Angular app consumes the **Reflexa Node.js REST API**.
All instructions below reflect the actual backend implementation.

---

## Backend Overview

- **Base URL:** `http://localhost:3000/api`
- **Auth:** JWT Bearer — `Authorization: Bearer <accessToken>`
- **Access token lifetime:** 15 minutes. Refresh before expiry using `POST /auth/refresh-token`.
- **All responses** follow a consistent envelope (see Response Shape).

### Response Shape

```typescript
// Success
{ success: true; data: T }

// Success with message
{ success: true; message: string; data: T }

// Error
{ success: false; message: string }

// Validation error (400)
{ success: false; message: "Validation failed"; errors: Record<string, string[]> }
```

---

## Angular Architecture Conventions

### HTTP Services — one service per API module
Create a service per backend module (`AuthService`, `OrganizationsService`, `DevicesService`, etc.).
Each service wraps `HttpClient` and maps the `data` field out of the envelope:

```typescript
listOrganizations(): Observable<OrganizationSummary[]> {
  return this.http.get<ApiResponse<{ organizations: OrganizationSummary[] }>>('/organizations')
    .pipe(map(r => r.data.organizations));
}
```

### Auth Interceptor — attach token + handle 401
Use an `HttpInterceptor` to:
1. Attach `Authorization: Bearer <accessToken>` from in-memory storage.
2. On `401`, call `POST /auth/refresh-token` once, update stored tokens, retry original request.
3. If refresh also fails → redirect to `/login` and clear all tokens.

### Token Storage — never `localStorage`
| Token | Storage |
|---|---|
| `accessToken` | In-memory (Angular service / signal) |
| `refreshToken` | `HttpOnly` cookie (preferred) or in-memory |

> Never store tokens in `localStorage` — XSS risk.

### Proactive Refresh
Decode the access token JWT client-side (read the `exp` field) and schedule a refresh ~60 seconds before expiry. No server call needed to read the payload.

---

## Shared TypeScript Interfaces

Copy these interfaces into `src/app/core/models/` (or similar):

```typescript
interface ApiResponse<T> { success: boolean; data: T; message?: string; }

interface SafeUser {
  id: string; email: string; emailVerified: boolean;
  firstName: string | null; lastName: string | null;
  displayName: string | null; avatarUrl: string | null;
  isSuperAdmin: boolean; createdAt: string;
}

interface TokenPair { accessToken: string; refreshToken: string; }

interface OrganizationSummary {
  id: string; name: string; slug: string;
  description: string | null; isActive: boolean; createdAt: string;
}

interface MemberWithRoles {
  membershipId: string; userId: string; email: string;
  firstName: string | null; lastName: string | null;
  displayName: string | null; status: string;
  joinedAt: string; roles: string[];
}

interface DeviceKitSummary {
  id: string; organizationId: string; name: string; code: string;
  description: string | null; ownerUserId: string | null;
  maxPods: number; createdAt: string;
}

interface DeviceKitDetail extends DeviceKitSummary { hub: HubSummary | null; podCount: number; }

interface HubSummary {
  id: string; hardwareUid: string; serialNumber: string | null;
  firmwareVersion: string | null; bluetoothName: string | null;
  isActive: boolean; lastSeenAt: string | null;
}

interface PodSummary {
  id: string; hardwareUid: string; serialNumber: string | null;
  firmwareVersion: string | null; currentDeviceKitId: string | null;
  displayName: string | null; logicalIndex: number | null;
  batteryPercent: number | null; batteryLevel: 'HIGH'|'MEDIUM'|'LOW'|null;
  isActive: boolean; lastSeenAt: string | null;
}

interface KitAccessGrant {
  id: string; deviceKitId: string; userId: string;
  canOperate: boolean; canManage: boolean;
  grantedByUserId: string | null; createdAt: string;
}

interface SessionSummary {
  id: string; organizationId: string; deviceKitId: string;
  hubDeviceId: string | null; startedByUserId: string | null;
  assignedToUserId: string | null; assignedByUserId: string | null;
  teamId: string | null; origin: string; syncStatus: string;
  clientSessionId: string | null; status: string; endMode: string;
  presetId: string | null; trainingMode: string;
  sessionStartedAt: string; sessionEndedAt: string; durationMs: number;
  score: number | null; hitCount: number; missCount: number;
  accuracyPercent: number | null; avgReactionMs: number | null;
  bestReactionMs: number | null; worstReactionMs: number | null;
  activePodCount: number; totalEventsCount: number;
  notes: string | null; createdAt: string; updatedAt: string;
}

interface SessionDetail extends SessionSummary {
  configJson: Record<string, unknown>;
  activePods: { id: string; podDeviceId: string; podOrder: number | null; }[];
  events: {
    id: string; podDeviceId: string | null; eventIndex: number;
    eventType: string; eventTimestamp: string; elapsedMs: number | null;
    reactionTimeMs: number | null; isCorrect: boolean | null;
    payloadJson: Record<string, unknown> | null;
  }[];
}

interface PresetSummary {
  id: string; organizationId: string | null; createdByUserId: string;
  scope: 'USER' | 'ORGANIZATION'; name: string;
  description: string | null; createdAt: string; updatedAt: string;
}

interface PresetDetail extends PresetSummary { configJson: Record<string, unknown>; }

interface TeamSummary {
  id: string; organizationId: string; name: string;
  description: string | null; createdAt: string; updatedAt: string;
}

interface TeamDetail extends TeamSummary { memberCount: number; }

interface TeamMemberSummary {
  id: string; teamId: string; userId: string; email: string;
  firstName: string | null; lastName: string | null;
  displayName: string | null; joinedAt: string;
}

interface ViewerScopeSummary {
  id: string; organizationId: string; viewerUserId: string;
  targetUserId: string; grantedByUserId: string | null; createdAt: string;
}
```

---

## API Endpoints Quick Reference

### Auth — `/auth` (public unless marked 🔒)

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/auth/register` | `{ email, password, firstName?, lastName?, displayName? }` | `{ user: SafeUser }` + message |
| `POST` | `/auth/login` | `{ email, password }` | `{ user: SafeUser, tokens: TokenPair }` |
| `POST` | `/auth/verify-email` | `{ token }` | `{ message }` |
| `POST` | `/auth/refresh-token` | `{ refreshToken }` | `{ tokens: TokenPair }` |
| `POST` | `/auth/logout` | `{ refreshToken }` | `{ message }` |
| `GET` | `/auth/me` 🔒 | — | `{ user: SafeUser }` |

**Auth flow:** register → verify email (token from DB during dev) → login → store tokens → intercept 401 → refresh → retry.  
Password rules: min 8 chars, 1 uppercase, 1 number.

---

### Organizations — `/organizations` 🔒

| Method | Path | Permission | Body / Response |
|---|---|---|---|
| `POST` | `/organizations` | any auth user | `{ name, slug, description? }` → `{ organization: OrganizationSummary }` |
| `GET` | `/organizations` | any auth user | `{ organizations: OrganizationSummary[] }` |
| `GET` | `/organizations/:orgId/me` | active member | `{ organization, membership, effectivePermissions: string[] }` |
| `POST` | `/organizations/:orgId/members` | `users.manage` | `{ email, roleCodes? }` → `{ member: MemberWithRoles }` |
| `GET` | `/organizations/:orgId/members` | `users.manage` | `{ members: MemberWithRoles[] }` |
| `POST` | `/organizations/:orgId/members/:membershipId/roles` | `users.manage` | `{ roleCodes: string[] }` → `{ assignedRoles: string[] }` |
| `GET` | `/organizations/:orgId/members/:membershipId/permissions` | self OR `users.manage` | `{ membershipId, userId, organizationId, permissions: string[] }` |

**Role codes:** `ORG_ADMIN` · `TRAINER` · `ATHLETE` · `VIEWER`  
**Permission codes:** `users.manage` · `teams.manage` · `devices.manage` · `presets.manage` · `session.start` · `session.end` · `session.assign` · `session.delete` · `viewer.scope.manage`

---

### Devices — `/devices` 🔒

| Method | Path | Notes |
|---|---|---|
| `POST` | `/devices/kits` | `{ organizationId, name, code, description?, maxPods? }` → `{ kit: DeviceKitSummary }` — requires `devices.manage` |
| `GET` | `/devices/kits` | `{ kits: DeviceKitSummary[] }` — shows owned + shared + org kits |
| `GET` | `/devices/kits/:kitId` | `{ kit: DeviceKitDetail }` — includes hub and pod count |
| `POST` | `/devices/kits/:kitId/hub` | `{ hardwareUid, serialNumber?, firmwareVersion?, bluetoothName? }` → `{ hub: HubSummary }` — one hub per kit |
| `POST` | `/devices/kits/:kitId/pods` | `{ pods: [...] }` → `{ pods: PodSummary[] }` — batch, all-or-nothing |
| `GET` | `/devices/kits/:kitId/pods` | `{ pods: PodSummary[] }` |
| `POST` | `/devices/kits/:kitId/access` | `{ userId, canOperate, canManage }` → `{ access: KitAccessGrant }` — upsert |
| `GET` | `/devices/kits/:kitId/access` | `{ accessGrants: KitAccessGrant[] }` |
| `POST` | `/devices/pods/:podId/reassign` | `{ targetDeviceKitId }` → `{ pod: PodSummary }` — requires manage on both kits |

---

### Sessions — `/sessions` 🔒

| Method | Path | Notes |
|---|---|---|
| `POST` | `/sessions/sync` | Large body (see below). Idempotent on `(organizationId, clientSessionId)`. Returns 201 (new) or 200 (duplicate). |
| `GET` | `/sessions` | `?organizationId&assignedToUserId?&teamId?&limit?&offset?` → `{ sessions: SessionSummary[] }` |
| `GET` | `/sessions/:id` | `{ session: SessionDetail }` — includes events and active pods |
| `PATCH` | `/sessions/:id/assign` | `{ assignedToUserId?, teamId? }` → `{ session: SessionSummary }` — requires `session.assign` |
| `DELETE` | `/sessions/:id` | Soft delete. Idempotent. Requires `session.delete`. |

**Sync body key fields:** `clientSessionId`, `organizationId`, `deviceKitId`, `origin`, `status`, `endMode`, `trainingMode`, `configJson`, `sessionStartedAt`, `sessionEndedAt`, `durationMs`, `hitCount`, `missCount` — plus optional `activePods[]` and `events[]`.

---

### Presets — `/presets` 🔒

| Method | Path | Notes |
|---|---|---|
| `POST` | `/presets` | `{ scope, organizationId?, name, description?, configJson }` → `{ preset: PresetDetail }` |
| `GET` | `/presets` | `?scope?&organizationId?&createdByUserId?` → `{ presets: PresetSummary[] }` |
| `GET` | `/presets/:id` | `{ preset: PresetDetail }` |
| `PATCH` | `/presets/:id` | `{ name?, description?, configJson? }` — at least one field required |
| `DELETE` | `/presets/:id` | Soft delete. Idempotent. |

---

### Teams — `/teams` 🔒

| Method | Path | Notes |
|---|---|---|
| `POST` | `/teams` | `{ organizationId, name, description? }` → `{ team: TeamDetail }` — requires `teams.manage` |
| `GET` | `/teams` | `?organizationId?` → `{ teams: TeamSummary[] }` |
| `GET` | `/teams/:id` | `{ team: TeamDetail }` |
| `POST` | `/teams/:id/members` | `{ userId }` → `{ members: TeamMemberSummary[] }` — user must be active org member |
| `GET` | `/teams/:id/members` | `{ members: TeamMemberSummary[] }` |
| `DELETE` | `/teams/:teamId/members/:userId` | Idempotent. Requires `teams.manage`. |

---

### Viewer Scopes — `/viewer-scopes` 🔒

> Only user-level visibility is supported (`viewerUserId → targetUserId`). Team-scoped visibility is not implemented.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/viewer-scopes` | `{ organizationId, viewerUserId, targetUserId }` → `{ scope: ViewerScopeSummary }` — requires `viewer.scope.manage` |
| `GET` | `/viewer-scopes` | `?organizationId&viewerUserId?` → `{ scopes: ViewerScopeSummary[] }` |
| `DELETE` | `/viewer-scopes/:scopeId` | Idempotent. Requires `viewer.scope.manage`. |

---

### Health

`GET /health` — public. Returns `{ status: "ok", timestamp: string }`.

---

## Error Handling

| Status | Meaning | Angular action |
|---|---|---|
| 400 | Validation failed — `errors` object has field-level messages | Show field errors from `error.errors` |
| 401 | Bad/expired token | Interceptor: refresh → retry → redirect to login |
| 403 | Authenticated but not allowed (inactive, unverified, no permission) | Show access-denied UI, do not retry |
| 404 | Resource not found | Show not-found state |
| 409 | Duplicate resource | Show conflict message from `error.message` |
| 500 | Unexpected server error | Show generic error, log locally |

> `403` on login = account deactivated OR email unverified — check `error.message` to differentiate.

---

## Email Verification (Dev Only)

Email delivery is not implemented. To get the verification token during development, query the database directly:

```sql
SELECT token FROM app.email_verification_tokens
WHERE user_id = '<userId>' AND used_at IS NULL
ORDER BY created_at DESC;
```

Then `POST /auth/verify-email` with `{ token }`.

