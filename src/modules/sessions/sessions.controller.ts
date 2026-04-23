import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { sendSuccess, sendSuccessWithMessage } from '../../shared/utils/response.js';
import { SessionsService } from './sessions.service.js';
import {
    SyncSessionInput,
    AssignSessionInput,
    ListSessionsFilters,
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

    // GET /sessions — query params validated by validate(listSessionsQuerySchema, 'query') in routes
    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const filters = req.query as unknown as ListSessionsFilters;
            const { sessions, total, limit, offset } = await this.sessionsService.listSessions(filters, req.user);
            sendSuccess(res, { sessions, pagination: { total, limit, offset } });
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
