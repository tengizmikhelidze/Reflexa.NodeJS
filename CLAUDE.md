# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start with tsx watch (hot reload)
npm run build     # Compile TypeScript to dist/
npm start         # Run compiled output (production)
```

No test runner or linter is configured yet.

## Architecture

Express 5 + TypeScript API backed by MSSQL. All routes are under `/api`.

### Module structure

Every feature lives in `src/modules/<name>/` with these files:

```
*.routes.ts       — factory function (createXRouter), composes dependencies, registers routes
*.controller.ts   — HTTP layer: extract input, call service, sendSuccess/next(err)
*.service.ts      — business logic, throws AppError subclasses
*.repository.ts   — raw SQL via mssql, returns typed *Row objects
*.validation.ts   — Zod schemas used by the validate() middleware
*.types.ts        — input interfaces, response interfaces
*.mapper.ts       — DB row → API response shape (strips sensitive fields, renames snake_case → camelCase)
```

### Dependency injection

No framework — manual composition inside each `create*Router()` factory:

```ts
const pool = await getDb();
const repo = new XRepository(pool);
const service = new XService(repo);
const controller = new XController(service);
```

All factories are called once at startup in `src/routes/index.ts` and share the same pool singleton.

### Request lifecycle

```
Request → validate() middleware (Zod) → Controller → Service → Repository → DB
                                                    ↓
                                            AppError thrown
                                                    ↓
                                         next(err) → errorMiddleware → JSON response
```

### Error handling

Throw from services using the classes in `src/shared/errors/http-errors.ts`:

| Class | Status |
|---|---|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |

`errorMiddleware` catches all errors. Unknown errors return a generic 500 — never leak internals.

### Response format

Use helpers from `src/shared/utils/response.ts`:

```ts
sendSuccess(res, data, statusCode?)              // { success: true, data }
sendSuccessWithMessage(res, data, message, code) // { success: true, message, data }
```

### Validation

Zod schemas in `*.validation.ts`, applied per-route with `validate(schema)`. Emails are normalized (trim + lowercase) at the Zod boundary — nothing downstream ever sees a raw email. Input type-cast in controller: `req.body as XInput`.

### Database conventions

- Schema prefix: `app.` on all tables
- UUIDs as primary keys (`sql.UniqueIdentifier`)
- Snake_case columns; repositories return typed `*Row` interfaces
- Soft deletes: `deleted_at IS NULL` in all queries
- Timestamps set in SQL (`SYSUTCDATETIME()`), not in application code
- Always use parameterized inputs — never string-concatenate into queries

### Auth & tokens

- **Access token:** stateless JWT (15 min), verified by `authMiddleware`, payload attached to `req.user`
- **Refresh token:** JWT stored as SHA-256 hash in DB; rotated on every use; reuse of a revoked token revokes *all* user tokens
- **Email verification:** random token (not hashed), one-time use, 24 h expiry; users cannot log in until verified
- Super admin (`isSuperAdmin`) bypasses all permission checks throughout the codebase

### Environment

All env vars are validated at startup in `src/config/env.ts` via `getEnv()` — add new vars there before using them anywhere. The `.env` file contains the local values; required keys: `DB_*`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`.

### Keeping docs in sync

When auth endpoints or the email flow change, update all three of these files:
- `api-integrations.md` — full API reference (endpoint tables, request/response shapes)
- `.github/copilot-instructions.md` — Angular-focused quick reference
- `copilot/skills/06-auth-and-middleware.md` — middleware and token strategy skill doc
