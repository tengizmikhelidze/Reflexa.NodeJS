import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/http-errors.js';

type ValidateTarget = 'body' | 'params' | 'query';

/**
 * Returns an Express middleware that validates req.body, req.params, or req.query
 * against the given Zod schema.
 * On success: replaces the target with the parsed (and coerced) value, then calls next().
 * On failure: throws a ValidationError with field-level messages.
 *
 * Usage:
 *   validate(registerSchema)              — validates req.body (default)
 *   validate(orgIdSchema, 'params')       — validates req.params
 *   validate(listQuerySchema, 'query')    — validates req.query (supports coerce for numbers)
 */
export function validate<T>(schema: ZodSchema<T>, target: ValidateTarget = 'body') {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const source =
            target === 'params' ? req.params :
            target === 'query'  ? req.query  :
            req.body;

        const result = schema.safeParse(source);

        if (!result.success) {
            const details = formatZodErrors(result.error);
            return next(new ValidationError('Validation failed', details));
        }

        if (target === 'params') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (req as any).params = result.data;
        } else if (target === 'query') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (req as any).query = result.data;
        } else {
            req.body = result.data;
        }
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


