# AGENTS.md — Reflexa Node.js Backend

Production-grade REST API. **Stack:** Node.js · TypeScript 6 · Express 5 · MSSQL · Zod · JWT.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
   Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
---

## Developer Workflow

```bash
npm run dev      # tsx watch src/server.ts — hot reload, no build step
npm run build    # tsc → dist/
npm start        # node dist/server.js (requires build first)
```

No test runner is configured. Env vars must be present or the server exits on startup (`src/config/env.ts` throws on missing vars).

---

## Architecture

**Layered per module. Strict separation:**

| Layer | Responsibility | Rule |
|---|---|---|
| Controller | Parse `req`, call service, send response | Zero business logic |
| Service | All business logic, orchestrates repos + utils, throws typed errors | No HTTP imports |
| Repository | All SQL queries, returns typed DB rows | No HTTP concepts |
| Mapper | DB row → API response shape | Pure functions |
| Validation | Zod schemas for body / params / query | Used by `validate()` middleware |

**Bootstrap order** (`src/server.ts`): `connectToDatabase()` → `createApiRouter()` → `mountRouter()` → `app.listen()`. `errorMiddleware` is always registered last — never move it.

**Dependency injection:** Each module router is an async factory that composes its own dependencies inline (no global singletons except the DB pool):

```typescript
export async function createDevicesRouter(): Promise<Router> {
    const pool = await getDb();
    const repo = new DevicesRepository(pool);
    const service = new DevicesService(repo);
    const controller = new DevicesController(service);
    // wire routes...
}
```

**Adding a new module:** Create all 7 files (`types`, `validation`, `repository`, `mapper`, `service`, `controller`, `routes`), then register the router in `src/routes/index.ts`.

---

## Critical Conventions

### Import extensions — always `.js` in TypeScript source
```typescript
// CORRECT (NodeNext module resolution requires it)
import { validate } from '../../shared/middlewares/validate.middleware.js';
// WRONG — runtime failure
import { validate } from '../../shared/middlewares/validate.middleware';
```

### Environment variables — always via `env.*`, never `process.env`
```typescript
import { env } from '../../config/env.js';
env.jwtAccessSecret   // JWT_ACCESS_SECRET
env.bcryptSaltRounds  // BCRYPT_SALT_ROUNDS
```

### Error handling — throw typed `AppError` subclasses, never raw errors
```typescript
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/http-errors.js';
throw new NotFoundError('Organization not found.');      // → 404
throw new ForbiddenError('Insufficient permissions.');   // → 403
throw new ConflictError('Slug already in use.');         // → 409
```
The central `errorMiddleware` catches all `AppError` instances and forms the response. Unhandled errors return a generic 500.

### Response helpers — never `res.json()` directly
```typescript
import { sendSuccess, sendSuccessWithMessage } from '../../shared/utils/response.js';
sendSuccess(res, data);                           // { success: true, data }
sendSuccessWithMessage(res, data, 'Check email'); // { success: true, message, data }
```

### Validation middleware — validate body, params, and query separately
```typescript
router.get('/:orgId/members',
    validate(orgIdParamSchema, 'params'),   // path params
    validate(listQuerySchema, 'query'),     // query string (use zod coerce for numbers)
    controller.listMembers
);
router.post('/', validate(createOrgSchema), controller.create);  // body (default)
```

---

## Database Patterns

- All tables live in the **`app` schema**: `app.users`, `app.organizations`, `app.roles`, etc.
- Use parameterized queries exclusively via `mssql` typed inputs (e.g. `sql.UniqueIdentifier`, `sql.NVarChar(200)`).
- Multi-step writes use `sql.Transaction`: `begin()` → writes → `commit()`, with `rollback()` in the catch block.
- Roles and permissions are **DB-seeded** (not hardcoded at runtime). Seed scripts: `database/queries/10.seed_esential_roles_and_perms.sql`, `11.seed_role_permissions.sql`. Look up role IDs by code before use.

---

## Auth & Permissions

- `authMiddleware` verifies the JWT Bearer token and attaches `req.user` as `AuthUser` (`userId`, `email`, `emailVerified`, `isSuperAdmin`).
- Apply `authMiddleware` per-route or router-wide with `router.use(authMiddleware)`.
- **`isSuperAdmin` bypasses all org-level permission checks.** Always check super admin first:
  ```typescript
  async requirePermission(orgId: string, actor: AuthUser, permCode: string) {
      if (actor.isSuperAdmin) return;
      // ...check membership + effective permissions
  }
  ```
- Effective permissions = role-based grants UNION direct user grants (see `organizations.repository.ts → findEffectivePermissions`).
- Refresh tokens are stored as **SHA-256 hashes only**; raw tokens are never persisted.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/config/env.ts` | Typed env loader — add new vars here |
| `src/shared/errors/http-errors.ts` | All typed error classes |
| `src/shared/middlewares/validate.middleware.ts` | Zod validation middleware factory |
| `src/shared/utils/response.ts` | `sendSuccess`, `sendSuccessWithMessage` |
| `src/routes/index.ts` | Register new module routers here |
| `src/modules/organizations/` | Most complete module — use as implementation reference |
| `database/queries/` | SQL schema and seed scripts |
| `copilot/skills/` | Detailed pattern documentation per topic |

