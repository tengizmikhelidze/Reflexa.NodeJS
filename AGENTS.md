# AGENTS.md — Reflexa Node.js Backend

Production-grade REST API. **Stack:** Node.js · TypeScript 6 · Express 5 · MSSQL · Zod · JWT.

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

