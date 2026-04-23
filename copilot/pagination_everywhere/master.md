You are my senior backend engineer. We need to add **consistent pagination across the Reflexa backend**.

Current backend modules already exist:

* auth
* organizations
* devices
* sessions
* presets
* teams
* viewer scopes

Stack:

* Node.js
* TypeScript
* Express
* MSSQL
* modular architecture

Architecture must remain:

* controllers = thin HTTP layer only
* services = business logic
* repositories = SQL only
* middleware = auth / validation / error handling
* shared = reusable utilities/types/errors

Do not redesign the architecture.
Do not introduce unnecessary abstractions.
Do not do style-only refactors.

---

# GOAL

Implement **consistent server-side pagination** for all list endpoints where result size can grow.

This includes at minimum:

* GET /organizations
* GET /devices/kits
* GET /devices/kits/:deviceKitId/access
* GET /devices/kits/:deviceKitId/pods
* GET /sessions
* GET /presets
* GET /teams
* GET /teams/:teamId/members
* GET /viewer-scopes
* any other existing list endpoint that can grow unbounded

Do NOT paginate endpoints that return a single resource.

---

# PAGINATION RULES

Use one consistent model across the whole backend.

## Required query params

* `page`
* `pageSize`

## Defaults

* page = 1
* pageSize = 20

## Limits

* page must be >= 1
* pageSize must be >= 1
* pageSize must be capped (for example 100 max)

## Response shape

All paginated list endpoints must return:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 135,
      "totalPages": 7
    }
  }
}
```

Do not invent a different shape per module.

---

# IMPLEMENTATION RULES

## Validation

Use Zod for pagination query validation.
Do not parse query params manually in controllers.

## Repository

Repository list methods must support:

* offset
* limit
* total count query

Use MSSQL pagination correctly:

* `ORDER BY`
* `OFFSET ... ROWS`
* `FETCH NEXT ... ROWS ONLY`

Do not forget deterministic ordering.

## Service

Service should accept validated pagination input and return:

* items
* pagination metadata

## Controller

Controllers remain thin:

* read validated query
* call service
* return standard paginated response

---

# SHARED REUSABLE PIECES

Create shared pagination helpers if needed, but keep them minimal.

Acceptable shared additions:

* `src/shared/types/pagination.types.ts`
* `src/shared/validation/pagination.validation.ts`
* `src/shared/utils/pagination.ts`

Do not over-engineer.

---

# IMPORTANT

1. Every paginated endpoint must use deterministic ordering.
2. Soft-deleted records must remain excluded.
3. Existing filters must still work with pagination.
4. If a module already has list filters, pagination must compose cleanly with them.
5. Do not break response consistency.
6. If any endpoint should intentionally stay unpaginated, explain why clearly.

---

# WORKFLOW

Do NOT generate everything at once.

Work in this exact order:

1. Audit all existing list endpoints and decide which need pagination
2. Define the shared pagination model (types + validation + response pattern)
3. Implement shared pagination helpers
4. Apply pagination module by module
5. Show final endpoint list with pagination support
6. Do a final consistency audit

At each step:

* explain briefly
* generate code only for that step
* wait for my confirmation

Start with Step 1 only:
**audit all current list endpoints and identify which must be paginated, which can remain unpaginated, and why.**
