# Skill 08 — Response Pattern

All HTTP responses use helpers from `src/shared/utils/response.ts`.
Never call `res.json()` directly in controllers.

---

## Response Helpers

```typescript
import { sendSuccess, sendSuccessWithMessage } from '../../shared/utils/response.js';

// Standard success — { success: true, data: { ... } }
sendSuccess(res, data);
sendSuccess(res, data, 201);   // with custom status code

// Success with message — { success: true, message: "...", data: { ... } }
sendSuccessWithMessage(res, data, 'Registration successful.', 201);
```

---

## Response Shapes

### Success
```json
{
  "success": true,
  "data": { }
}
```

### Success with message (register, verify email, logout)
```json
{
  "success": true,
  "message": "Human-readable message.",
  "data": { }
}
```

### Error (thrown AppError subclass)
```json
{
  "success": false,
  "message": "Human-readable error."
}
```

### Validation error (400)
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

## HTTP Status Code Rules

| Code | When |
|------|------|
| `200` | GET, successful update, logout, token refresh |
| `201` | POST that creates a new resource |
| `400` | Validation failure — always from `validate()` middleware |
| `401` | Missing/invalid/expired token; bad credentials |
| `403` | Authenticated but not permitted; inactive user; unverified email |
| `404` | Resource not found |
| `409` | Duplicate resource (email taken, slug taken, already a member, token already used) |
| `500` | Unhandled errors — logged server-side, generic message to client |

---

## Controller Response Examples

```typescript
// 201 — Created
sendSuccess(res, { organization: result }, 201);

// 200 — Data
sendSuccess(res, { members: result });

// 200 — Message only (e.g. verify email)
sendSuccess(res, { message: 'Email verified successfully.' });

// 201 — Created with message
sendSuccessWithMessage(res, { user: result.user }, result.message, 201);
```

---

## Wrapping Data Keys

Always wrap response data in a meaningful key — never return raw arrays or primitives at `data`:

```typescript
// CORRECT
sendSuccess(res, { organizations: result });    // data.organizations is the array
sendSuccess(res, { member: result }, 201);      // data.member is the object

// WRONG
sendSuccess(res, result);                       // data is a raw array — unclear
```

---

## Error Middleware Response

Errors are handled by `src/middlewares/error.middleware.ts` — registered as the last middleware.
Never respond to errors in controllers.

```typescript
// CORRECT — always forward errors
} catch (err) { next(err); }

// WRONG
} catch (err) {
    res.status(500).json({ error: err.message });
}
```

