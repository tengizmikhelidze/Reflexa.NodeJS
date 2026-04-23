import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';
import { SessionsController } from './sessions.controller.js';
import {
    syncSessionSchema,
    assignSessionSchema,
    sessionIdParamSchema,
} from './sessions.validation.js';

/**
 * All session routes require authentication.
 * Body/param validation is applied per route via validate().
 * Access control is enforced at service level.
 */
export async function createSessionsRouter(): Promise<Router> {
    const pool = await getDb();

    const orgsRepo     = new OrganizationsRepository(pool);
    const sessionsRepo = new SessionsRepository(pool);
    const service      = new SessionsService(sessionsRepo, orgsRepo);
    const controller   = new SessionsController(service);

    const router = Router();

    // All routes require a valid access token
    router.use(authMiddleware);

    // POST /sessions/sync — sync a completed offline session
    router.post(
        '/sync',
        validate(syncSessionSchema),
        controller.sync
    );

    // GET /sessions — list sessions (supports ?organizationId, ?assignedToUserId, ?teamId)
    router.get('/', controller.list);

    // GET /sessions/:sessionId — get session detail with pods + events
    router.get(
        '/:sessionId',
        validate(sessionIdParamSchema, 'params'),
        controller.getDetail
    );

    // PATCH /sessions/:sessionId/assign — update assignment
    router.patch(
        '/:sessionId/assign',
        validate(sessionIdParamSchema, 'params'),
        validate(assignSessionSchema),
        controller.assign
    );

    // DELETE /sessions/:sessionId — soft delete + audit log
    router.delete(
        '/:sessionId',
        validate(sessionIdParamSchema, 'params'),
        controller.delete
    );

    return router;
}

