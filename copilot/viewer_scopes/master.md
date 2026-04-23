You are my senior backend engineer. We are extending the Reflexa backend with the **Viewer Scopes module**.

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture
* auth, organizations, devices, sessions, presets, teams modules already implemented

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

# DATABASE CONTEXT

Use the existing MSSQL schema and do NOT silently change it.

Tables available for this phase:

* app.viewer_access_scopes
* app.organizations
* app.users
* app.teams
* app.organization_memberships
* app.organization_membership_roles
* app.roles
* app.permissions
* app.role_permissions
* app.user_permission_grants

If any schema mismatch exists, stop and state the minimal migration needed.

---

# GOAL OF THIS PHASE

Implement:

* grant viewer access
* list viewer scopes
* revoke viewer scope

This phase is about **who a viewer may see**.
Do NOT implement session queries here.
Do NOT redesign the role model.

---

# VIEWER SCOPE MODEL RULES

* viewer scopes are organization-scoped
* a viewer may be granted visibility to:

    * a target user
* if team-scoped visibility is not supported by current schema, say so clearly and do not fake it
* only authorized admin/trainer users may grant/revoke viewer scopes
* a viewer must be a real user in the system
* target user must belong to the same organization

---

# ENDPOINTS

Implement:

* POST   /viewer-scopes
* GET    /viewer-scopes
* DELETE /viewer-scopes/:scopeId

If you think one small support endpoint is necessary, explain why before adding it.

---

# PERMISSION MODEL

Use existing organization permission infrastructure.

Suggested minimum rules:

* grant/revoke viewer scopes requires `viewer.scope.manage`
* listing viewer scopes requires active organization membership and appropriate permission
* super admin bypass where appropriate

If the permission seed is missing `viewer.scope.manage`, stop and show the minimal seed addition needed.

---

# VALIDATION RULES

Use Zod consistently.

Validate:

* create scope input
* list query params
* scopeId path param

Do not validate ad hoc in controllers.

---

# TYPES / OUTPUTS

Define types for:

* viewer scope summary
* create viewer scope input
* list scope filters

Do not expose unnecessary internal DB fields.

---

# WORKFLOW

Do NOT generate everything at once.

Work in this exact order:

1. Propose final file list for this phase
2. Verify schema assumptions against existing tables/columns
3. Define types + validation
4. Implement repositories
5. Implement service
6. Implement access helper if needed
7. Implement controller + routes
8. Integrate routes
9. Show test order and sample requests/responses
10. Do a gap audit for this phase

At each step:

* explain briefly
* generate code only for that step
* wait for my confirmation

Start with Step 1 only:
**propose the final file list for the Viewer Scopes module and explain why each file exists.**
