You are my senior backend engineer. We are extending the Reflexa backend with the **Teams module**.

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture
* auth, organizations, devices, sessions, presets modules already implemented

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

* app.teams
* app.team_memberships
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

Implement:

* create team
* list teams
* team detail
* add team members
* remove team members
* list team members

Do NOT implement session analytics in this phase.
Do NOT implement viewer scopes in this phase.

---

# TEAM MODEL RULES

* a team belongs to one organization
* team names must be unique inside an organization
* only users who belong to the same organization can join that team
* soft-deleted teams must not appear in normal reads
* removing a user from a team only removes team membership, not organization membership

---

# ENDPOINTS

Implement:

* POST   /teams
* GET    /teams
* GET    /teams/:teamId
* POST   /teams/:teamId/members
* GET    /teams/:teamId/members
* DELETE /teams/:teamId/members/:userId

If you think one or two small support endpoints are necessary, explain why before adding them.

---

# PERMISSION MODEL

Use existing organization permission infrastructure.

Suggested minimum rules:

* team create/update/member management requires `teams.manage`
* listing team detail/members requires active organization membership
* super admin bypass where appropriate

If the permission seed is missing `teams.manage`, stop and show the minimal seed addition needed.

---

# VALIDATION RULES

Use Zod consistently.

Validate:

* create team input
* add team member input
* list filters if added
* teamId path param
* userId path param

Do not validate ad hoc in controllers.

---

# TYPES / OUTPUTS

Define types for:

* team summary
* team detail
* team member summary
* create team input
* add team member input

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
**propose the final file list for the Teams module and explain why each file exists.**
