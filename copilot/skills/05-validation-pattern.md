# Skill 05 — Validation Pattern

All request validation uses **Zod**. No validation in controllers. No class-validator.

---

## validate() Middleware

Located at `src/shared/middlewares/validate.middleware.ts`.

```typescript
// Validate req.body (default)
validate(schema)

// Validate req.params
validate(schema, 'params')

// Validate req.query — use z.coerce.number() for numeric params
validate(schema, 'query')
```

On success: replaces `req.body`, `req.params`, or `req.query` with the parsed/coerced value.
On failure: throws `ValidationError('Validation failed', { field: ['message'] })` → 400.

### Query param schemas must use `z.coerce` for numbers

```typescript
export const listSessionsQuerySchema = z.object({
    organizationId: z.string().uuid().optional(),
    limit:          z.coerce.number().int().min(1).max(200).default(50),
    offset:         z.coerce.number().int().min(0).default(0),
});
```

Query string values are always strings — `z.coerce.number()` converts them before validation.

---

## Applying in Routes

```typescript
// Body validation
router.post('/', validate(createThingSchema), controller.create);

// Params validation
router.get('/:thingId', validate(thingIdParamSchema, 'params'), controller.getById);

// Query validation (with pagination)
router.get('/', validate(listQuerySchema, 'query'), controller.list);

// Both params + body — order: params first, then body
router.post(
    '/:orgId/members',
    validate(orgIdParamSchema, 'params'),
    validate(addMemberSchema),
    controller.addMember
);
```

---

## Writing Schemas

### Text fields
```typescript
name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
description: z.string().trim().max(1000).optional(),
```

### Email (always normalise)
```typescript
email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()       // ← normalise at validation boundary
    .email('Invalid email address'),
```

### Password (register — enforce rules)
```typescript
password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
```

### Password (login — presence only, no strength rules)
```typescript
// Login: presence check only — avoids leaking validation policy
password: z.string().min(1, 'Password is required'),
```

### UUID path params
```typescript
export const thingIdParamSchema = z.object({
    thingId: z.string().uuid('thingId must be a valid UUID'),
});
```

### Arrays
```typescript
roleCodes: z
    .array(z.string().trim().min(1, 'Role code cannot be empty'))
    .min(1, 'At least one role code is required'),
```

### Slug
```typescript
slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(150)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
```

---

## Exporting Types from Schemas

Always export inferred types alongside schemas:

```typescript
export const createThingSchema = z.object({ name: z.string() });
export type CreateThingSchema = z.infer<typeof createThingSchema>;
```

---

## Email Normalisation Contract

Email is **always** lowercased and trimmed **at the Zod schema level**.
Nothing downstream normalises email. The DB `normalized_email` column is `UPPER(email)` —
repository handles the `toUpperCase()` for lookup only.

```
Request body: "  Alex@Example.COM  "
                      ↓ Zod .trim().toLowerCase()
Service receives:  "alex@example.com"
                      ↓ repository .toUpperCase() for WHERE clause only
DB lookup:         WHERE normalized_email = 'ALEX@EXAMPLE.COM'
```

---

## What NOT to Do

```typescript
// WRONG — validating in controller
create = async (req, res, next) => {
    if (!req.body.name) return res.status(400).json({ error: 'Name required' });
    // ...
};

// WRONG — no validation at all on parameterised routes
router.get('/:id', controller.getById);
// ↑ a non-UUID string reaches the DB and causes a mssql cast error
```

