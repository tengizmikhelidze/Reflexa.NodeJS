import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/http-errors.js';

/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * On success: replaces req.body with the parsed (and coerced) value, then calls next().
 * On failure: throws a ValidationError with field-level messages.
 *
 * Usage: router.post('/register', validate(registerSchema), controller.register)
 */
export function validate<T>(schema: ZodSchema<T>) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const details = formatZodErrors(result.error);
            return next(new ValidationError('Validation failed', details));
        }

        req.body = result.data;
        next();
    };
}

/**
 * Converts a ZodError into a flat Record<fieldPath, string[]> for consistent API responses.
 * e.g. { email: ['Invalid email address'], password: ['Too short'] }
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
    return error.issues.reduce<Record<string, string[]>>(
        (acc: Record<string, string[]>, issue) => {
            const key = issue.path.join('.') || '_root';
            if (!acc[key]) acc[key] = [];
            acc[key].push(issue.message);
            return acc;
        },
        {}
    );
}


