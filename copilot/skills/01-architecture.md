# Skill 01 — Project Architecture

## Stack

- **Runtime:** Node.js (CommonJS, `"type": "commonjs"` in package.json)
- **Language:** TypeScript 6, strict mode, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
- **Framework:** Express 5
- **Database:** MSSQL via `mssql` package, schema prefix `app.*`
- **Validation:** Zod
- **Auth:** JWT (`jsonwebtoken`) — access + refresh token pattern
- **Password:** bcrypt
- **Module system:** CommonJS — import extensions must be `.js` in TypeScript source even though files are `.ts`

---

## Folder Structure

```
src/
├── app.ts                     # Express app factory — middleware setup, mountRouter()
├── server.ts                  # Bootstrap: connectToDatabase → createApiRouter → mountRouter → listen
├── config/
│   ├── database.ts            # ConnectionPool singleton, getDb(), connectToDatabase()
│   └── env.ts                 # Typed fail-fast env loader — throws if required var missing
├── middlewares/
│   ├── auth.middleware.ts     # JWT Bearer verification → req.user
│   └── error.middleware.ts    # Centralized error handler — must be registered LAST
├── routes/
│   └── index.ts               # Async router factory — composes all module routers
├── controllers/
│   └── health.controller.ts   # Simple health check
├── shared/
│   ├── errors/
│   │   ├── app-error.ts       # Base AppError class
│   │   └── http-errors.ts     # ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError
│   ├── middlewares/
│   │   └── validate.middleware.ts  # validate(schema) and validate(schema, 'params')
│   ├── types/
│   │   ├── auth-user.types.ts # AuthUser interface — attached to req.user
│   │   └── express.d.ts       # Express Request augmentation: user?: AuthUser
│   └── utils/
│       ├── crypto.utils.ts    # generateSecureToken(), hashToken() (SHA-256)
│       ├── password.utils.ts  # hashPassword(), comparePassword() (bcrypt)
│       ├── token.utils.ts     # signAccessToken(), signRefreshToken(), verifyAccessToken(), verifyRefreshToken(), getTokenExpiry()
│       └── response.ts        # sendSuccess(), sendSuccessWithMessage()
└── modules/
    ├── users/
    │   ├── users.types.ts     # UserRow interface — shared by all modules
    │   └── users.repository.ts
    ├── auth/
    │   ├── auth.types.ts
    │   ├── auth.validation.ts
    │   ├── auth.repository.ts
    │   ├── auth.mapper.ts
    │   ├── auth.service.ts
    │   ├── auth.controller.ts
    │   └── auth.routes.ts
    ├── organizations/
    │   ├── organizations.types.ts
    │   ├── organizations.validation.ts
    │   ├── organizations.repository.ts
    │   ├── organizations.mapper.ts
    │   ├── organizations.service.ts
    │   ├── organizations.controller.ts
    │   └── organizations.routes.ts
    └── devices/
        ├── devices.types.ts       # DB row types + request/response interfaces
        ├── devices.validation.ts  # Zod schemas for body + path params
        ├── devices.repository.ts  # SQL: kits, hubs, pods, pairing history, access grants
        ├── devices.mapper.ts      # DB rows → API shapes
        ├── devices.service.ts     # Business logic + access-check helpers
        ├── devices.controller.ts  # Thin HTTP handlers
        └── devices.routes.ts      # Route wiring + dependency composition
```

---

## Bootstrap Flow (server.ts)

```
connectToDatabase()          ← DB pool created first
    ↓
createApiRouter()            ← async: all module routers composed
    ↓
mountRouter(apiRouter)       ← app.use('/api', router) + errorMiddleware registered LAST
    ↓
app.listen(port)
```

**Critical:** `errorMiddleware` is always the last middleware registered. Express matches middleware in order.

---

## Module Routing

All module routers are async factory functions (they need the DB pool):

```typescript
// routes/index.ts
export async function createApiRouter(): Promise<Router> {
    const router = Router();
    router.use('/auth', await createAuthRouter());
    router.use('/organizations', await createOrganizationsRouter());
    return router;
}
```

Each module router composes its own dependencies internally — no global singletons:

```typescript
export async function createOrganizationsRouter(): Promise<Router> {
    const pool = await getDb();
    const repo = new OrganizationsRepository(pool);
    const service = new OrganizationsService(repo, usersRepo);
    const controller = new OrganizationsController(service);
    // wire routes...
}
```

---

## Environment Variables

All env vars live in `src/config/env.ts`. Access via `env.varName` — never `process.env` directly.

```typescript
import { env } from '../../config/env.js';
env.jwtAccessSecret        // JWT_ACCESS_SECRET
env.jwtAccessExpiresIn     // JWT_ACCESS_EXPIRES_IN
env.bcryptSaltRounds       // BCRYPT_SALT_ROUNDS
env.emailVerificationTokenExpiresHours
```

If a required variable is missing at startup, `getEnv()` throws immediately — the server will not start.

---

## Import Extension Rule

**Always use `.js` extensions** on relative imports in TypeScript source:

```typescript
// CORRECT
import { AppError } from './app-error.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';

// WRONG — will fail at runtime under NodeNext module resolution
import { AppError } from './app-error';
```

