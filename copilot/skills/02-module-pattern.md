# Skill 02 — Module Pattern

Every feature module follows the same file structure and responsibility split.
Copy this pattern exactly when adding a new module.

---

## File List for a New Module

```
src/modules/<name>/
├── <name>.types.ts        # DB row types + request inputs + response payloads
├── <name>.validation.ts   # Zod schemas for body and path params
├── <name>.repository.ts   # All SQL — typed, no business logic
├── <name>.mapper.ts       # DB row → API response (strips internal fields)
├── <name>.service.ts      # All business logic — orchestrates repo + utils
├── <name>.controller.ts   # Thin HTTP handlers — read request, call service, send response
└── <name>.routes.ts       # Route wiring + dependency injection
```

---

## types.ts — Template

```typescript
// ─── DB Row Types (match DB columns exactly, snake_case) ──────────────────────
export interface ThingRow {
    id: string;
    name: string;
    is_active: boolean;
    created_at: Date;
    deleted_at: Date | null;
}

// ─── Request Inputs (camelCase, after Zod parsing) ───────────────────────────
export interface CreateThingInput {
    name: string;
    description?: string;
}

// ─── Response Payloads (camelCase, safe — no sensitive fields) ───────────────
export interface ThingSummary {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
}
```

---

## validation.ts — Template

```typescript
import { z } from 'zod';

// Path param schema — validated with validate(schema, 'params')
export const thingIdParamSchema = z.object({
    thingId: z.string().uuid('thingId must be a valid UUID'),
});

// Body schema — validated with validate(schema)
export const createThingSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(1000).optional(),
});

export type CreateThingSchema = z.infer<typeof createThingSchema>;
```

**Rules:**
- Always validate path params with `validate(schema, 'params')` on parameterised routes.
- Always validate request body with `validate(schema)`.
- Never validate inline in controllers.
- Normalise email with `.trim().toLowerCase()` at the Zod level — downstream code never sees raw email.

---

## repository.ts — Template

```typescript
import sql from 'mssql';
import { ThingRow } from './things.types.js';

export class ThingsRepository {
    constructor(private readonly pool: sql.ConnectionPool) {}

    async findById(id: string): Promise<ThingRow | null> {
        const result = await this.pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query<ThingRow>(`
                SELECT id, name, is_active, created_at, deleted_at
                FROM app.things
                WHERE id = @id AND deleted_at IS NULL
            `);
        return result.recordset[0] ?? null;
    }

    async create(name: string): Promise<ThingRow> {
        const result = await this.pool
            .request()
            .input('name', sql.NVarChar(200), name)
            .query<ThingRow>(`
                INSERT INTO app.things (name)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.is_active,
                       INSERTED.created_at, INSERTED.deleted_at
                VALUES (@name)
            `);
        return result.recordset[0];
    }
}
```

**Rules:**
- All column names in SQL match the DB schema exactly.
- Use `OUTPUT INSERTED.*` for inserts — single round-trip.
- Always filter `deleted_at IS NULL` for soft-delete tables.
- Never import from `express`, never throw HTTP errors.
- See `03-repository-pattern.md` for full SQL conventions.

---

## mapper.ts — Template

```typescript
import { ThingRow } from './things.types.js';
import { ThingSummary } from './things.types.js';

export function mapThing(row: ThingRow): ThingSummary {
    return {
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        createdAt: row.created_at,
        // deleted_at, updated_at, internal flags — intentionally omitted
    };
}
```

**Rules:**
- One mapper file per module.
- Only file allowed to transform DB rows into response shapes.
- Never return `password_hash`, `deleted_at`, internal flags.
- Always camelCase response fields (DB uses snake_case).

---

## service.ts — Template

```typescript
import { NotFoundError, ConflictError } from '../../shared/errors/http-errors.js';
import { ThingsRepository } from './things.repository.js';
import { mapThing } from './things.mapper.js';
import { CreateThingInput, ThingSummary } from './things.types.js';
import { AuthUser } from '../../shared/types/auth-user.types.js';

export class ThingsService {
    constructor(private readonly thingsRepo: ThingsRepository) {}

    async create(input: CreateThingInput, actor: AuthUser): Promise<ThingSummary> {
        // Business logic here
        const existing = await this.thingsRepo.findByName(input.name);
        if (existing) throw new ConflictError('Thing already exists.');

        const row = await this.thingsRepo.create(input.name);
        return mapThing(row);
    }

    async getById(id: string): Promise<ThingSummary> {
        const row = await this.thingsRepo.findById(id);
        if (!row) throw new NotFoundError('Thing not found.');
        return mapThing(row);
    }
}
```

**Rules:**
- All business rules live here. No SQL. No HTTP.
- Throw typed `AppError` subclasses — never raw `Error` for user-facing cases.
- Always use mapper before returning.
- See `04-error-handling.md` for which error class to use when.

---

## controller.ts — Template

```typescript
import { Request, Response, NextFunction } from 'express';
import { ThingsService } from './things.service.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { CreateThingInput } from './things.types.js';

export class ThingsController {
    constructor(private readonly thingsService: ThingsService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const result = await this.thingsService.create(req.body as CreateThingInput, req.user);
            sendSuccess(res, { thing: result }, 201);
        } catch (err) { next(err); }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const id = req.params['thingId'] as string;
            const result = await this.thingsService.getById(id);
            sendSuccess(res, { thing: result });
        } catch (err) { next(err); }
    };
}
```

**Rules:**
- Arrow function methods — preserve `this` binding for router.
- Always guard `if (!req.user)` before accessing `req.user` on protected routes.
- Always `catch (err) { next(err); }` — never handle errors inline.
- Always use `sendSuccess` / `sendSuccessWithMessage` from `shared/utils/response.ts`.
- Access path params via `req.params['paramName'] as string` to satisfy TypeScript strict typing.
- See `08-response-pattern.md` for status codes.

---

## routes.ts — Template

```typescript
import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { ThingsRepository } from './things.repository.js';
import { ThingsService } from './things.service.js';
import { ThingsController } from './things.controller.js';
import { createThingSchema, thingIdParamSchema } from './things.validation.js';

export async function createThingsRouter(): Promise<Router> {
    const pool = await getDb();
    const repo = new ThingsRepository(pool);
    const service = new ThingsService(repo);
    const controller = new ThingsController(service);

    const router = Router();

    // All routes protected
    router.use(authMiddleware);

    router.post('/', validate(createThingSchema), controller.create);
    router.get('/:thingId', validate(thingIdParamSchema, 'params'), controller.getById);

    return router;
}
```

**Rules:**
- Async factory — dependency injection happens here.
- `router.use(authMiddleware)` before all routes if all routes are protected.
- `validate(schema)` for body, `validate(schema, 'params')` for path params.
- Register in `src/routes/index.ts` after creation: `router.use('/things', await createThingsRouter())`.

---

## Registration in routes/index.ts

```typescript
import { createThingsRouter } from '../modules/things/things.routes.js';

export async function createApiRouter(): Promise<Router> {
    // ...existing routes...
    router.use('/things', await createThingsRouter());
    return router;
}
```

