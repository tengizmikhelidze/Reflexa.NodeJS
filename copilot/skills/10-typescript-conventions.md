# Skill 10 — TypeScript Conventions

---

## tsconfig Highlights

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "strict": true,
  "noImplicitAny": true
}
```

- `NodeNext` module resolution: imports must use `.js` extension in source.
- `strict`: no implicit any, strict null checks, no implicit returns.

---

## Import Extension Rule

Always `.js` on relative imports — even though the file is `.ts`:

```typescript
import { AppError } from './app-error.js';          // ✅
import { AppError } from './app-error';              // ❌ runtime error
import { AppError } from './app-error.ts';           // ❌ TS error
```

For external packages: no extension needed (`import sql from 'mssql'`).

---

## Typing DB Row Interfaces

DB rows use exact column names (snake_case). BIT columns become `boolean`:

```typescript
export interface UserRow {
    id: string;                    // uniqueidentifier
    email: string;                 // nvarchar
    normalized_email: string;      // computed column
    password_hash: string;         // nvarchar
    email_verified: boolean;       // bit
    first_name: string | null;     // nullable nvarchar
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;       // bit
    is_active: boolean;            // bit
    created_at: Date;              // datetime2
    updated_at: Date;
    deleted_at: Date | null;       // nullable — soft delete
}
```

---

## Typing Repository Query Results

Always provide a generic type argument to `.query<T>()`:

```typescript
const result = await this.pool
    .request()
    .query<UserRow>(`SELECT ...`);

const row: UserRow | null = result.recordset[0] ?? null;
const rows: UserRow[] = result.recordset;
```

---

## Typing Request Params

Express types `req.params` values as `string | string[]`. Cast explicitly:

```typescript
const orgId = req.params['organizationId'] as string;
const memberId = req.params['membershipId'] as string;
```

After `validate(schema, 'params')` runs, the value is guaranteed to be a valid string
(Zod has already coerced and validated it).

---

## Arrow Function Methods in Classes

Use arrow functions for controller methods — preserves `this` binding
so methods can be passed directly to `router.post(...)`:

```typescript
export class ThingsController {
    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // ↑ arrow function — `this` is always the class instance
    };
}

// Safe to pass directly without .bind():
router.post('/', validate(schema), controller.create);
```

Regular methods require `.bind(this)` or an anonymous wrapper. Don't do that.

---

## AuthUser on req.user

The `AuthUser` type is the application auth identity — never raw `JwtPayload`:

```typescript
// CORRECT
if (!req.user) return next(new UnauthorizedError());
const userId = req.user.userId;       // string
const isAdmin = req.user.isSuperAdmin; // boolean

// WRONG — do not cast to JwtPayload or any
const payload = req.user as jwt.JwtPayload;  // loses type safety
```

---

## Avoiding `any`

```typescript
// WRONG
const result: any = await repo.findById(id);

// CORRECT — always type the result
const result: UserRow | null = await repo.findById(id);
```

The only allowed `any` cast is for `req.params` override in the validate middleware:

```typescript
(req as any).params = result.data;  // necessary to override Express read-only typing
```

---

## Null vs Undefined Convention

| Case | Use |
|------|-----|
| DB nullable column | `string | null` — explicit null |
| Optional function input | `string | undefined` or `?: string` |
| "Not found" from repository | Return `null` — never `undefined` |
| Optional Zod field | `.optional()` → `string | undefined` after parse |

Always `?? null` when a recordset could be empty:

```typescript
return result.recordset[0] ?? null;  // never result.recordset[0] alone
```

---

## Return Type Annotations

Always annotate service and repository method return types explicitly:

```typescript
async findById(id: string): Promise<UserRow | null> { ... }
async create(input: CreateInput): Promise<UserRow> { ... }
async createOrg(input: CreateInput): Promise<OrganizationSummary> { ... }
```

Do not rely on inference for public API boundaries — it makes refactoring brittle.

