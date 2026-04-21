/**
 * Base class for all application-level errors.
 * Carries an HTTP statusCode so the error middleware
 * can respond with the correct status without any guessing.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        // Operational = expected, user-facing errors (not bugs).
        // The error middleware uses this to decide whether to log a full stack trace.
        this.isOperational = true;

        // Restore prototype chain (required when extending built-ins in TypeScript)
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

