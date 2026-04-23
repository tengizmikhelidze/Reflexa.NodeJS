You are my senior backend engineer. We are now refining **session visibility rules** in the Reflexa backend.

Current modules already exist:

* auth
* organizations
* devices
* sessions
* presets
* teams
* viewer scopes

Current stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture

Architecture must remain:

* controllers = thin
* services = business logic
* repositories = SQL only
* middleware = auth / validation / error handling
* shared = reusable utilities/types/errors

Do not redesign the architecture.
Do not introduce unnecessary abstractions.

---

# GOAL

Make session visibility **correct, explicit, and consistent** across:

* super admin
* org admin
* trainer
* athlete
* viewer

This phase is about visibility and access rules only.
Do not redesign sessions.
Do not redesign teams or viewer scopes.
Do not add analytics features.

---

# REQUIRED VISIBILITY MODEL

Define and implement clear rules for who can see session list/detail.

Expected actors:

## Super Admin

* may see all sessions

## Organization Admin

* may see all sessions in their organization

## Trainer

* may see:

  * sessions they started
  * sessions assigned to athletes they are allowed to manage
  * sessions in their organization if your current permission model explicitly allows it
* be explicit and safe

## Athlete/User

* may see:

  * sessions assigned to themselves
  * optionally sessions they started themselves if your business rules allow it
* be explicit

## Viewer

* may see only sessions for subjects explicitly allowed by viewer scopes
* if viewer scopes only support user-scoped visibility right now, say that clearly and implement accordingly
* do not fake team-scoped viewer access if schema does not support it cleanly

---

# WHAT TO REVIEW / IMPLEMENT

Review and refine:

* GET /sessions
* GET /sessions/:sessionId

Make sure both use the same visibility logic.

If needed, implement:

* a shared session-visibility helper/service
* repository query changes
* minimal service changes

Do not create new major modules unless absolutely necessary.

---

# RULES

* visibility must be organization-scoped
* inactive memberships must not grant access
* super admin bypass must be centralized and consistent
* viewer scope rules must be explicit
* self-access rules must be explicit
* do not scatter visibility logic across many files
* keep it maintainable and testable

---

# WORKFLOW

Do NOT dump everything at once.

Work in this exact order:

1. define the final visibility rules in a clear matrix
2. identify gaps in the current implementation
3. generate only the necessary fixes
4. provide final test cases / scenarios

Start with Step 1 only:
**define the final session visibility rules as a matrix for super admin, org admin, trainer, athlete, and viewer.**
