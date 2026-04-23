# Reflexa Backend — Skills Index

This folder contains architecture and pattern reference files for the Reflexa Node.js backend.
Load the relevant file(s) before implementing any feature.

---

## Files

| File | When to load |
|------|-------------|
| `01-architecture.md` | Always — project structure, stack, module rules |
| `02-module-pattern.md` | When adding any new module (types → repo → service → controller → routes) |
| `03-repository-pattern.md` | When writing any SQL / DB access code |
| `04-error-handling.md` | When throwing errors, writing middleware, or handling failures |
| `05-validation-pattern.md` | When adding request validation (body or path params) |
| `06-auth-and-middleware.md` | When protecting routes, reading `req.user`, or checking tokens |
| `07-permissions-pattern.md` | When implementing organization-scoped permission checks |
| `08-response-pattern.md` | When sending HTTP responses from controllers |
| `09-database-transactions.md` | When multiple SQL writes must be atomic |
| `10-typescript-conventions.md` | When writing types, interfaces, and strict TS patterns |

---

## Implemented Modules

| Module | Base path | Key permission |
|--------|-----------|---------------|
| Auth | `/api/auth` | — (public + Bearer) |
| Organizations | `/api/organizations` | `users.manage` |
| Devices | `/api/devices` | `devices.manage` |

---

## Maintenance Rule ⚠️

**Whenever any of the following change, update the relevant skill file(s) immediately:**

| Change type | Update these skill files |
|-------------|--------------------------|
| New module added | `01-architecture.md` (folder structure), `02-module-pattern.md` if pattern evolves |
| New DB table or column | `03-repository-pattern.md` (active record conventions), `01-architecture.md` if schema section exists |
| New error class or status code rule | `04-error-handling.md` |
| Zod validation pattern change | `05-validation-pattern.md` |
| Auth flow change (tokens, secrets, routes) | `06-auth-and-middleware.md` |
| New permission code or role | `07-permissions-pattern.md` |
| Response shape change | `08-response-pattern.md` |
| Transaction pattern change | `09-database-transactions.md` |
| TypeScript config or convention change | `10-typescript-conventions.md` |
| New route registered in `routes/index.ts` | `01-architecture.md` (module routing section) |

Do not defer skill file updates — stale skill files cause AI sessions to generate incorrect code.

---

## Quick Rules (always apply)

- Controllers: read request → call service → send response. **No logic.**
- Services: all business rules. **No SQL, no HTTP.**
- Repositories: all SQL. **No business logic.**
- Shared utils: pure functions. **No DB, no HTTP.**
- All errors are typed `AppError` subclasses — never raw `throw new Error()` for user-facing cases.
- All routes are validated with Zod before reaching the controller.
- All protected routes use `authMiddleware` — never inline JWT checks.

