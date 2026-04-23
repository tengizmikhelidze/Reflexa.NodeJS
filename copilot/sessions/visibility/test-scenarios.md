# Session Visibility — Test Scenarios

## Setup Assumptions

```
Org:  "Team Alpha"  (orgId = ORG-1)

Users:
  superAdmin     — is_super_admin = true
  orgAdmin       — ACTIVE member of ORG-1, has session.start + session.assign + session.delete (via ORG_ADMIN role)
  trainer        — ACTIVE member of ORG-1, has session.start + session.assign (via TRAINER role)
  athlete1       — ACTIVE member of ORG-1, no session.* permissions
  athlete2       — ACTIVE member of ORG-1, no session.* permissions
  viewer1        — ACTIVE member of ORG-1, has viewer_access_scope → athlete1 (can see athlete1's sessions)
  outsider       — NOT a member of ORG-1

Sessions:
  S1 — assigned_to=athlete1, started_by=orgAdmin,  org=ORG-1
  S2 — assigned_to=athlete2, started_by=trainer,   org=ORG-1
  S3 — assigned_to=null,     started_by=athlete1,  org=ORG-1
  S4 — assigned_to=athlete1, started_by=trainer,   org=ORG-1
  S5 — assigned_to=null,     started_by=null,       org=ORG-1  (unassigned)

viewer_access_scopes:
  viewer1 → athlete1   (in ORG-1)
```

---

## GET /sessions?organizationId=ORG-1

### Super Admin

| Query | Expected result | Sessions returned |
|-------|----------------|-------------------|
| `?organizationId=ORG-1` | 200 OK | S1, S2, S3, S4, S5 |
| *(no orgId)* | 200 OK — all orgs | S1, S2, S3, S4, S5 (+ any from other orgs) |
| `?assignedToUserId=athlete1` | 200 OK | S1, S4 |
| `?teamId=<teamId>` | 200 OK | sessions with that teamId |

### Org Admin (elevated — has session.* permissions)

| Query | Expected result | Sessions returned |
|-------|----------------|-------------------|
| `?organizationId=ORG-1` | 200 OK | S1, S2, S3, S4, S5 |
| *(no orgId)* | **403** — organizationId required | — |
| `?organizationId=ORG-1&assignedToUserId=athlete2` | 200 OK | S2 |

### Trainer (elevated — has session.start + session.assign)

| Query | Expected result | Sessions returned |
|-------|----------------|-------------------|
| `?organizationId=ORG-1` | 200 OK | S1, S2, S3, S4, S5 |
| *(no orgId)* | **403** | — |
| `?organizationId=ORG-1&assignedToUserId=athlete1` | 200 OK | S1, S4 |

### Athlete1 (restricted — no session.* permissions)

| Query | Expected result | Visibility rule |
|-------|----------------|-----------------|
| `?organizationId=ORG-1` | 200 OK | Only sessions where `assigned_to = athlete1` OR `started_by = athlete1` |
| Returned sessions: | S1, S3, S4 | S1 (assigned to me), S3 (started by me), S4 (assigned to me) |
| `?organizationId=ORG-1&assignedToUserId=athlete2` | 200 OK - **empty** | athlete1 cannot see athlete2's sessions via filter |
| *(no orgId)* | **403** | — |

### Athlete2 (restricted — no session.* permissions)

| Query | Expected result | Sessions returned |
|-------|----------------|-------------------|
| `?organizationId=ORG-1` | 200 OK | S2 only (assigned to athlete2) |

### Viewer1 (restricted — viewer scope: can see athlete1's sessions)

| Query | Expected result | Visibility rule |
|-------|----------------|-----------------|
| `?organizationId=ORG-1` | 200 OK | Only sessions where `assigned_to = viewer1` (none) OR `started_by = viewer1` (none) OR `assigned_to ∈ viewer_scope_targets(viewer1)` |
| Returned sessions: | S1, S4 | S1 and S4 are assigned to athlete1 (viewer1's target) |
| S3 | **NOT returned** | S3 started by athlete1 but assigned_to is NULL — viewer scope only applies to assigned_to |

### Outsider (not a member)

| Query | Expected result |
|-------|----------------|
| `?organizationId=ORG-1` | **403** — not an active member |

---

## GET /sessions/:sessionId (detail)

### Super Admin

| Session | Expected |
|---------|----------|
| S1 | 200 OK — full detail |
| S2 | 200 OK — full detail |
| S5 | 200 OK — full detail |
| `?id=nonexistent` | 404 |

### Org Admin

| Session | Expected | Reason |
|---------|----------|--------|
| S1 | 200 OK | Elevated access — sees all org sessions |
| S2 | 200 OK | Elevated access |
| S5 | 200 OK | Elevated access |

### Trainer

| Session | Expected | Reason |
|---------|----------|--------|
| S1 | 200 OK | Elevated (session.start permission) |
| S2 | 200 OK | Elevated |
| S5 | 200 OK | Elevated |

### Athlete1 (restricted)

| Session | Expected | Reason |
|---------|----------|--------|
| S1 | 200 OK | assigned_to = athlete1 ✅ |
| S3 | 200 OK | started_by = athlete1 ✅ |
| S4 | 200 OK | assigned_to = athlete1 ✅ |
| S2 | **403** | assigned_to = athlete2, not athlete1. No viewer scope for athlete2. |
| S5 | **403** | assigned_to = null, started_by = null — no self-access |

### Athlete2 (restricted)

| Session | Expected | Reason |
|---------|----------|--------|
| S2 | 200 OK | assigned_to = athlete2 ✅ |
| S1 | **403** | assigned_to = athlete1, athlete2 has no viewer scope |
| S3 | **403** | started_by = athlete1, athlete2 has no viewer scope |

### Viewer1 (restricted — viewer scope: athlete1)

| Session | Expected | Reason |
|---------|----------|--------|
| S1 | 200 OK | assigned_to = athlete1, viewer1 has scope for athlete1 ✅ |
| S4 | 200 OK | assigned_to = athlete1, viewer1 has scope for athlete1 ✅ |
| S3 | **403** | assigned_to = null — viewer scope only checks assigned_to, not started_by |
| S2 | **403** | assigned_to = athlete2, no viewer scope for athlete2 |
| S5 | **403** | assigned_to = null — no access path |

### Outsider

| Session | Expected |
|---------|----------|
| Any | **403** — not an active member of ORG-1 |

---

## Edge Cases

| Scenario | Expected behaviour |
|----------|--------------------|
| Athlete tries to pass `?assignedToUserId=athlete2` | Visibility WHERE clause for restricted users ANDs with the filter — can never see athlete2's sessions regardless of filter |
| Super admin with `?limit=200&offset=0` | Returns up to 200 sessions, paginated |
| Invalid UUID in `?organizationId=not-a-uuid` | **400** — validated by `validate(listSessionsQuerySchema, 'query')` |
| `?limit=0` | **400** — min(1) enforced by Zod |
| `?limit=999` | **400** — max(200) enforced by Zod |
| Soft-deleted session | Never returned (deleted_at IS NULL enforced in SQL) |
| Member suspended mid-session | 403 on all endpoints — `membership.status !== 'ACTIVE'` check |
| Viewer1 → athlete1 viewer scope revoked | S1/S4 return 403 immediately (no caching) |

---

## Visibility Matrix Summary

| Actor | `GET /sessions` scope | `GET /sessions/:id` |
|-------|----------------------|---------------------|
| **Super Admin** | All sessions (optional filters) | Any session |
| **Org Admin** | All org sessions | Any org session |
| **Trainer** | All org sessions (has session.start) | Any org session |
| **Athlete** | Assigned-to-me + started-by-me | 200 if assigned/started-by me, else 403 |
| **Viewer** | Viewer-scoped (assigned_to ∈ targets) | 200 if assigned_to is a viewer target |
| **Outsider** | 403 | 403 |

> **Important:** A viewer with no viewer scopes behaves exactly like an Athletic with no assigned sessions — they see nothing. The viewer_access_scopes table controls the grant.

