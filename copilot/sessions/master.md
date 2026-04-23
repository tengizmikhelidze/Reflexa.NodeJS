You are my senior backend engineer. We are extending the Reflexa backend with the **Sessions module**.

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture
* auth module already implemented
* organizations + roles/permissions module already implemented
* devices module already implemented

Architecture must remain:

* controllers = thin HTTP layer only
* services = business logic
* repositories = SQL only
* middleware = auth / validation / error handling
* shared = reusable types, errors, utils

Do not redesign the architecture.
Do not introduce unnecessary abstractions.
Do not generate demo code.

---

# CURRENT SYSTEM CONTEXT

Already implemented:

* authentication
* organizations
* roles/permissions
* devices
* active membership rules
* organization-scoped permissions
* reusable validation middleware
* reusable auth middleware

We are now implementing the **Sessions module** only.

---

# DATABASE CONTEXT

Use the existing MSSQL schema and do NOT silently change it.

Tables available for this phase:

* app.training_sessions
* app.training_session_active_pods
* app.training_session_events
* app.device_kits
* app.hub_devices
* app.pod_devices
* app.users
* app.teams
* app.training_presets
* app.organizations
* app.organization_memberships
* app.organization_membership_roles
* app.roles
* app.permissions
* app.role_permissions
* app.user_permission_grants
* app.audit_logs

If any schema mismatch exists, stop and state the minimal migration needed.

---

# GOAL OF THIS PHASE

Implement the backend foundation for:

* syncing completed offline sessions
* storing session summary
* storing session active pods
* storing full event timeline
* listing sessions
* reading session detail
* assigning sessions to users/teams
* soft-deleting sessions with audit logging

Do NOT implement live hardware communication.
Do NOT implement analytics dashboards in this phase.
Do NOT implement teams management itself in this phase beyond assigning an existing `team_id`.

---

# SESSION MODEL RULES

## Sync model

* sessions are created offline on phone first
* each session has a client-generated unique identifier (`clientSessionId`)
* sync must be idempotent at organization level
* duplicate sync of same session must not create duplicates

## Session ownership

* `started_by_user_id` = operator who ran session
* `assigned_to_user_id` = athlete/user who owns result (optional)
* `team_id` = assigned team (optional)
* assignment may happen during sync or later

## Session structure

A session includes:

* summary data
* config_json
* active pod list
* event timeline

## Deletion

* deleting a session must be a soft delete
* deletion must create an audit log entry
* deleted sessions must not appear in normal list/detail queries

---

# WHAT TO BUILD IN THIS PHASE

Implement endpoints for:

* POST   /sessions/sync
* GET    /sessions
* GET    /sessions/:sessionId
* PATCH  /sessions/:sessionId/assign
* DELETE /sessions/:sessionId

If you think one or two small support endpoints are necessary, explain why before adding them.

---

# ENDPOINT RULES

## POST /sessions/sync

* authenticated
* requires valid organization access
* accepts one completed offline session payload
* sync must be idempotent by `(organization_id, client_session_id)`
* if session already exists, return existing record or a safe idempotent response
* store:

  * training_sessions row
  * training_session_active_pods rows
  * training_session_events rows
* use transaction safety
* validate referenced kit/hub/pods belong to the organization
* validate assigned user/team if present

## GET /sessions

* authenticated
* requires access to organization-scoped data
* list sessions visible to current user
* support at least basic filtering by:

  * organizationId
  * assignedToUserId
  * teamId
* super admin may see all if your existing model supports it

## GET /sessions/:sessionId

* authenticated
* return session detail:

  * summary
  * config
  * active pods
  * events
* enforce org-scoped visibility

## PATCH /sessions/:sessionId/assign

* authenticated
* requires permission to manage session assignment
* allow updating:

  * assigned_to_user_id
  * team_id
  * assigned_by_user_id should be current user
* validate user/team belong to same organization

## DELETE /sessions/:sessionId

* authenticated
* requires permission to delete sessions
* soft delete session
* write audit log
* repeated delete should be safe/idempotent

---

# PERMISSION MODEL

Use existing organization permission infrastructure.

Session operations should respect:

* active organization membership
* org-level permissions from roles/direct grants
* super admin bypass where appropriate

Suggested minimum rules:

* syncing a session requires authenticated org access
* assigning sessions requires a permission such as `session.assign` or a current equivalent if you already mapped this capability differently
* deleting sessions requires `session.delete`
* viewing session detail/list must respect org membership and future viewer access rules

If the current permission seed is missing a required permission code, stop and show the minimal migration or seed addition needed.

---

# VALIDATION RULES

Use Zod consistently.

Validate:

* sync session payload
* list query params
* sessionId path param
* assign payload

Do not validate ad hoc in controllers.

---

# TYPES / OUTPUTS

Define types for:

* session summary response
* session detail response
* sync payload
* session event item
* active pod item
* assign session payload
* list session filters

Do not expose unnecessary internal DB fields.

---

# IMPORTANT IMPLEMENTATION DETAILS

1. Sync must be transaction-safe
2. Sync must be idempotent
3. Soft delete must exclude records from normal reads
4. Audit log must be written on delete
5. Event timeline may be large — keep response shape clean
6. Validate cross-organization references carefully
7. Do not silently accept invalid pod/team/user assignments
8. Preserve architecture boundaries

---

# WORKFLOW

Do NOT generate everything at once.

Work in this exact order:

1. Propose final file list for this phase
2. Verify schema assumptions against existing tables/columns
3. Define types + validation
4. Implement repositories
5. Implement service
6. Implement permission/access helper if needed
7. Implement controller + routes
8. Integrate routes
9. Show test order and sample requests/responses
10. Do a gap audit for this phase

At each step:

* explain briefly
* generate code only for that step
* wait for my confirmation

Start with Step 1 only:
**propose the final file list for the Sessions module and explain why each file exists.**
