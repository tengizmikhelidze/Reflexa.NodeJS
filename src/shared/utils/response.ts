import { Response } from 'express';

/**
 * Sends a consistent success response: { success: true, data: T }
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json({ success: true, data });
}

/**
 * Sends a consistent success response with a message field included.
 * Used for responses that carry both data and a human-readable message.
 */
export function sendSuccessWithMessage<T>(
    res: Response,
    data: T,
    message: string,
    statusCode = 200
): void {
    res.status(statusCode).json({ success: true, message, data });
}

