import { NextFunction, Request, Response } from 'express';

export function errorMiddleware(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error(error);

    if (error instanceof Error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
}
