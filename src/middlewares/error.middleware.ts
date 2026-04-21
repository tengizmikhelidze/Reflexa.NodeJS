import { NextFunction, Request, Response } from 'express';
import { AppError } from '../shared/errors/app-error';
import { ValidationError } from '../shared/errors/http-errors';

export function errorMiddleware(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Operational errors: known, typed, user-facing
    if (error instanceof AppError) {
        // ValidationError may carry field-level detail
        if (error instanceof ValidationError && error.details) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: error.details
            });
            return;
        }

        res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
        return;
    }

    // Unexpected errors: log the full stack, return generic message
    console.error('[Unhandled Error]', error);

    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
}
