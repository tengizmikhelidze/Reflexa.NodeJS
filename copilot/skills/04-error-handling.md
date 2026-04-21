# Skill 04 — Error Handling

---

## Error Classes

All application errors extend `AppError` from `src/shared/errors/app-error.ts`.
Import from `src/shared/errors/http-errors.ts`.

```typescript
import {
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
} from '../../shared/errors/http-errors.js';
```

---

## When to Use Each Error

| Class | HTTP | Use when |
|-------|------|---------|
| `ValidationError` | 400 | Request body / params fail schema validation |
| `UnauthorizedError` | 401 | No/invalid/expired token; wrong credentials |
| `ForbiddenError` | 403 | Authenticated but not permitted; account inactive/unverified; wrong membership status |
| `NotFoundError` | 404 | Resource does not exist (org, user, token, membership) |
| `ConflictError` | 409 | Duplicate resource (email taken, already a member, slug taken) |

**Common mistakes to avoid:**

| Situation | WRONG | CORRECT |
|-----------|-------|---------|
| Token already used | `UnauthorizedError` | `ConflictError` — it's a state conflict |
| Token expired | `UnauthorizedError` | `ForbiddenError` — it's a permission boundary, not an auth failure |
| User is not a member | `UnauthorizedError` | `ForbiddenError` — they are authenticated, just not permitted |
| User deactivated after login | `UnauthorizedError` | `ForbiddenError` |
| Wrong password | `ForbiddenError` | `UnauthorizedError` — this IS an auth failure |

---

## Error Flow

```
Service → throw new ForbiddenError('...')
              ↓
Controller catches → next(err)
              ↓
Express → errorMiddleware(err, req, res, next)
              ↓
instanceof AppError?
    └── ValidationError with details? → 400 + { success, message, errors: { field: [...] } }
    └── any other AppError           → statusCode + { success, message }
    └── unknown error (bug)          → 500 + { success, message: 'Internal server error' }
                                         + full stack logged server-side
```

---

## Throwing Errors in Services

```typescript
// Not found
const user = await this.usersRepo.findById(id);
if (!user) throw new NotFoundError('User not found.');

// Conflict
const existing = await this.orgsRepo.findBySlug(slug);
if (existing) throw new ConflictError(`Slug "${slug}" is already taken.`);

// Forbidden — wrong state
if (!user.is_active) throw new ForbiddenError('Account is deactivated.');
if (!user.email_verified) throw new ForbiddenError('Email is not verified.');

// Unauthorized — bad credentials (use SAME message for "not found" and "wrong password")
if (!user || !passwordMatch) throw new UnauthorizedError('Invalid email or password.');
// ↑ same message prevents user enumeration
```

---

## Forwarding Errors in Controllers

**Always forward — never handle inline:**

```typescript
// CORRECT
create = async (req, res, next) => {
    try {
        const result = await this.service.create(req.body);
        sendSuccess(res, result, 201);
    } catch (err) { next(err); }   // ← forward to errorMiddleware
};

// WRONG — never do this
} catch (err) {
    res.status(500).json({ error: err.message });
}
```

---

## ValidationError with Field Details

The `validate` middleware creates `ValidationError` with Zod field details automatically.
When creating a `ValidationError` manually:

```typescript
throw new ValidationError('Validation failed', {
    email: ['Invalid email address'],
    password: ['Password must be at least 8 characters'],
});
```

Response shape:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid email address"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

---

## Seeding / Internal Errors

For internal configuration problems (not user errors), use a plain `Error`:

```typescript
// Not a user-facing error — a deployment/seeding problem
if (!orgAdminRole) {
    throw new Error('ORG_ADMIN role is not seeded. Run seed script.');
}
```

This produces a 500 and logs the full stack — correct behavior for a broken deployment.

