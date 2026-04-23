You are my senior backend engineer. We are extending the Reflexa backend with the **Presets module**.

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture
* auth module already implemented
* organizations + roles/permissions module already implemented
* devices module already implemented
* sessions module already implemented

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
* sessions
* active membership rules
* organization-scoped permissions
* reusable validation middleware
* reusable auth middleware

We are now implementing the **Presets module** only.

---

# DATABASE CONTEXT

Use the existing MSSQL schema and do NOT silently change it.

Tables available for this phase:

* app.training_presets
* app.organizations
* app.users
* app.organization_memberships
* app.organization_membership_roles
* app.roles
* app.permissions
* app.role_permissions
* app.user_permission_grants

If any schema mismatch exists, stop and state the minimal migration needed.

---

# GOAL OF THIS PHASE

Implement the backend foundation for:

* personal presets
* organization presets
* listing presets
* reading preset detail
* updating presets
* soft deleting presets

Do NOT implement frontend logic.
Do NOT implement sessions changes in this phase.
Do NOT redesign preset structure.

---

# PRESET MODEL RULES

## Scope

A preset can be:

* `USER` scope → personal preset
* `ORGANIZATION` scope → shared org preset

## Ownership

* user presets belong to `created_by_user_id`
* org presets belong to `organization_id`
* org presets still record `created_by_user_id`

## Access

* user can manage their own personal presets
* organization presets require organization-scoped permission to create/update/delete
* users can read organization presets only if they have active access to that organization
* super admin may bypass where appropriate

## Config

* preset `config_json` is stored as-is
* backend validates outer payload shape, but should not over-constrain future config evolution
* keep preset config flexible

---

# WHAT TO BUILD IN THIS PHASE

Implement endpoints for:

* POST   /presets
* GET    /presets
* GET    /presets/:presetId
* PATCH  /presets/:presetId
* DELETE /presets/:presetId

If you think one or two small support endpoints are necessary, explain why before adding them.

---

# ENDPOINT RULES

## POST /presets

* authenticated
* create preset
* support both USER and ORGANIZATION scopes
* if scope = ORGANIZATION, require valid org access + org preset management permission
* return preset summary

## GET /presets

* authenticated
* list presets visible to current user
* include:

  * personal presets created by current user
  * org presets from organizations the user can access
* support optional filters:

  * scope
  * organizationId
  * createdByUserId (if appropriate)

## GET /presets/:presetId

* authenticated
* return preset detail if visible to current user
* enforce owner/org access rules

## PATCH /presets/:presetId

* authenticated
* allow updating:

  * name
  * description
  * config_json
* only owner can edit personal preset
* only authorized org user can edit org preset

## DELETE /presets/:presetId

* authenticated
* soft delete preset
* only owner can delete personal preset
* only authorized org user can delete org preset
* repeated delete should be safe/idempotent

---

# PERMISSION MODEL

Use existing organization permission infrastructure.

Suggested minimum rule:

* org preset create/update/delete requires `presets.manage`
* listing/reading org presets requires active organization membership
* personal presets do not require org permission

If the permission seed is missing `presets.manage`, stop and show the minimal seed addition needed.

---

# VALIDATION RULES

Use Zod consistently.

Validate:

* create preset input
* update preset input
* list query params
* presetId path param

Do not validate ad hoc in controllers.

---

# TYPES / OUTPUTS

Define types for:

* preset summary
* preset detail
* create preset input
* update preset input
* list preset filters

Do not expose unnecessary internal DB fields.

---

# IMPORTANT IMPLEMENTATION DETAILS

1. Soft delete must exclude presets from normal reads
2. Scope rules must be explicit
3. Personal vs org ownership rules must be enforced cleanly
4. Config JSON should remain flexible
5. Super admin behavior must be centralized and consistent

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
**propose the final file list for the Presets module and explain why each file exists.**
