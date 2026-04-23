import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { sendSuccess, sendSuccessWithMessage } from '../../shared/utils/response.js';
import { SessionsService } from './sessions.service.js';
import { listSessionsQuerySchema } from './sessions.validation.js';
import {
    SyncSessionInput,
    AssignSessionInput,
} from './sessions.types.js';

export class SessionsController {
    constructor(private readonly sessionsService: SessionsService) {}

    // POST /sessions/sync
    sync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const { session, created } = await this.sessionsService.syncSession(
                req.body as SyncSessionInput,
                req.user
            );
            sendSuccess(res, { session }, created ? 201 : 200);
        } catch (err) { next(err); }
    };

    // GET /sessions
    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());

            // Parse and validate query params inline (middleware supports body/params only)
            const parsed = listSessionsQuerySchema.safeParse(req.query);
            const filters = parsed.success ? parsed.data : {};

            const sessions = await this.sessionsService.listSessions(filters, req.user);
            sendSuccess(res, { sessions });
        } catch (err) { next(err); }
    };

    // GET /sessions/:sessionId
    getDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const session = await this.sessionsService.getSessionDetail(
                req.params['sessionId'] as string,
                req.user
            );
            sendSuccess(res, { session });
        } catch (err) { next(err); }
    };

    // PATCH /sessions/:sessionId/assign
    assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const session = await this.sessionsService.assignSession(
                req.params['sessionId'] as string,
                req.body as AssignSessionInput,
                req.user
            );
            sendSuccess(res, { session });
        } catch (err) { next(err); }
    };

    // DELETE /sessions/:sessionId
    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            await this.sessionsService.deleteSession(
                req.params['sessionId'] as string,
                req.user
            );
            sendSuccessWithMessage(res, null, 'Session deleted.');
        } catch (err) { next(err); }
    };
}

