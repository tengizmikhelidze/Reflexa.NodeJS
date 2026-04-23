import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { OrganizationsRepository } from '../organizations/organizations.repository.js';
import { ViewerScopesRepository } from './viewer-scopes.repository.js';
import { ViewerScopesService } from './viewer-scopes.service.js';
import { ViewerScopesController } from './viewer-scopes.controller.js';
import {
    createViewerScopeSchema,
    scopeIdParamSchema,
} from './viewer-scopes.validation.js';

export async function createViewerScopesRouter(): Promise<Router> {
    const pool = await getDb();

    const orgsRepo   = new OrganizationsRepository(pool);
    const scopesRepo = new ViewerScopesRepository(pool);
    const service    = new ViewerScopesService(scopesRepo, orgsRepo);
    const controller = new ViewerScopesController(service);

    const router = Router();

    // All routes require a valid access token
    router.use(authMiddleware);

    // POST /viewer-scopes
    router.post('/', validate(createViewerScopeSchema), controller.grant);

    // GET /viewer-scopes
    router.get('/', controller.list);

    // DELETE /viewer-scopes/:scopeId
    router.delete('/:scopeId', validate(scopeIdParamSchema, 'params'), controller.revoke);

    return router;
}

