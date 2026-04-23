You are my senior backend engineer. We are extending the Reflexa backend with the **organizations + roles/permissions foundation**.

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture
* auth foundation already implemented and working

Existing architecture must remain:

* controllers = thin HTTP layer only
* services = business logic
* repositories = SQL only
* middleware = auth / validation / error handling
* shared = reusable types, errors, utils

Do not redesign the architecture.
Do not add unnecessary abstractions.
Do not generate toy code.

---

# CURRENT STATE

Already implemented:

* auth module
* user registration/login/refresh/logout/verify email/me
* shared errors
* auth middleware
* MSSQL repositories
* route integration
* typed request user identity

Database schema already exists for:

* app.organizations
* app.roles
* app.permissions
* app.role_permissions
* app.organization_memberships
* app.organization_membership_roles
* app.user_permission_grants
* app.teams
* app.team_memberships
* app.viewer_access_scopes

Do NOT silently change schema assumptions. If any mismatch exists, stop and state the minimal migration needed.

---

# GOAL OF THIS PHASE

Implement the **organization and authorization foundation** only.

This phase must cover:

1. Organization creation
2. Organization membership
3. Assigning roles to organization memberships
4. Effective permission calculation
5. Direct permission grants
6. Current user’s organizations listing
7. Current user’s current organization access profile
8. Permission-checking helpers/middleware for future modules

Do NOT implement teams, devices, sessions, or viewer access management yet beyond what is needed for the permission foundation.

---

# REQUIRED BUSINESS RULES

## Roles

Supported roles already exist in DB:

* SUPER_ADMIN
* ORG_ADMIN
* TRAINER
* ATHLETE
* VIEWER

Assume:

* Super admin is global from `users.is_super_admin`
* organization roles come from `organization_membership_roles`

## Permissions

Permissions come from:

1. role-based permissions through `role_permissions`
2. direct user grants through `user_permission_grants`

Effective permissions for a user inside an organization =
role permissions UNION direct permission grants

## Membership

* a user can belong to multiple organizations
* membership is organization-scoped
* roles are attached to membership, not directly to the user
* inactive / left memberships must not be treated as active access

## Organization creation

When a user creates an organization:

* organization is created
* creator becomes an organization member
* creator is assigned ORG_ADMIN role for that organization

## Authorization behavior

* global super admin bypasses organization permission checks where appropriate
* non-members cannot access organization data
* permissions must be organization-scoped

---

# WHAT TO BUILD IN THIS PHASE

## Endpoints

At minimum, implement endpoints for:

* POST   /organizations
* GET    /organizations
* GET    /organizations/:organizationId/me
* POST   /organizations/:organizationId/members
* GET    /organizations/:organizationId/members
* POST   /organizations/:organizationId/members/:membershipId/roles
* GET    /organizations/:organizationId/members/:membershipId/permissions

If you think one or two small support endpoints are necessary, explain why before adding them.

---

# WHAT EACH ENDPOINT SHOULD DO

## POST /organizations

* authenticated
* create organization
* create membership for current user
* assign ORG_ADMIN role to that membership
* return organization summary

## GET /organizations

* authenticated
* return all organizations the current user can access
* if super admin, may return all active organizations

## GET /organizations/:organizationId/me

* authenticated
* verify current user belongs to organization (or is super admin)
* return:

    * organization info
    * membership info
    * roles
    * effective permissions

## POST /organizations/:organizationId/members

* authenticated
* requires organization-level permission to manage users
* initial version may add an existing user by email
* if user is already a member, return conflict
* create membership with default status ACTIVE
* optionally assign initial roles if provided

## GET /organizations/:organizationId/members

* authenticated
* requires permission to view/manage org members
* return active members with their roles

## POST /organizations/:organizationId/members/:membershipId/roles

* authenticated
* requires permission to manage users/roles
* replace or assign roles for a membership
* validate role codes exist
* keep logic explicit and safe

## GET /organizations/:organizationId/members/:membershipId/permissions

* authenticated
* requires permission to view/manage org members OR self-access if membership belongs to current user
* return effective permissions for that membership

---

# ARCHITECTURE RULES

Use module structure like:

src/modules/organizations/
organizations.controller.ts
organizations.routes.ts
organizations.service.ts
organizations.repository.ts
organizations.types.ts
organizations.validation.ts
organizations.mapper.ts

If needed, also add:

src/modules/permissions/
permissions.service.ts
permissions.repository.ts
permissions.types.ts

But keep it minimal. If organizations service can orchestrate this cleanly without creating a full extra module yet, prefer that.

---

# STRICT RESPONSIBILITY RULES

## Controller

* request parsing only
* call service
* send response
* no business logic

## Service

* all organization/membership/role/permission business rules
* compose repositories
* throw typed app errors

## Repository

* SQL only
* typed results
* no HTTP/business logic

## Middleware

* auth already exists
* add reusable permission guard only if needed in this phase
* permission middleware must remain organization-scoped and reusable

---

# VALIDATION RULES

Use Zod consistently.

Validate:

* organization creation input
* add member input
* role assignment input
* path params for organizationId and membershipId

Do not validate ad hoc in controllers.

---

# TYPES / OUTPUTS

Define types for:

* organization summary
* organization membership
* membership with roles
* effective permissions response
* add member input
* assign roles input

Never expose internal DB-only fields unnecessarily.

---

# IMPORTANT IMPLEMENTATION DETAILS

1. Be explicit about how role lookup works:

* by role code from `app.roles`

2. Be explicit about active membership rules:

* membership must have status ACTIVE
* left/suspended/inactive memberships do not count as access

3. Effective permission resolution must be deterministic:

* roles → permissions
* direct grants → permissions
* merge and de-duplicate

4. Super admin logic must be centralized and consistent

5. Permission checks must be reusable for later modules

---

# WORKFLOW

Do NOT generate everything at once.

Work in this exact order:

1. Propose final file list for this phase
2. Verify schema assumptions against existing tables/columns
3. Define types + validation
4. Implement repositories
5. Implement service
6. Implement permission helper/middleware if needed
7. Implement controller + routes
8. Integrate routes
9. Show test order and sample requests/responses
10. Do a gap audit for this phase

At each step:

* explain briefly
* generate code only for that step
* wait for my confirmation

Start with Step 1 only:
**propose the final file list for the organizations + roles/permissions foundation and explain why each file exists.**
