import { AppError } from './app-error';

/**
 * 400 — Request body or query params failed validation.
 * Optionally carries field-level detail (from Zod field errors).
 */
export class ValidationError extends AppError {
    public readonly details?: Record<string, string[]>;

    constructor(message = 'Validation failed', details?: Record<string, string[]>) {
        super(400, message);
        this.details = details;
    }
}

/**
 * 401 — Missing or invalid authentication credentials.
 */
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(401, message);
    }
}

/**
 * 403 — Authenticated but not allowed to perform this action.
 */
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(403, message);
    }
}

/**
 * 404 — Requested resource does not exist.
 */
export class NotFoundError extends AppError {
    constructor(message = 'Not found') {
        super(404, message);
    }
}

/**
 * 409 — Resource already exists or state conflict.
 */
export class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(409, message);
    }
}

