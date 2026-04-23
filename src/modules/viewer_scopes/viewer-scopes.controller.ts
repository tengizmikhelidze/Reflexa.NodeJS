import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { ViewerScopesService } from './viewer-scopes.service.js';
import { CreateViewerScopeInput, ListViewerScopesFilters } from './viewer-scopes.types.js';

export class ViewerScopesController {
    constructor(private readonly scopesService: ViewerScopesService) {}

    // POST /viewer-scopes
    grant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const scope = await this.scopesService.grantScope(req.body as CreateViewerScopeInput, req.user);
            sendSuccess(res, { scope }, 201);
        } catch (err) { next(err); }
    };

    // GET /viewer-scopes — query params validated by validate(listViewerScopesQuerySchema, 'query') in routes
    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            const filters = req.query as unknown as ListViewerScopesFilters;
            const scopes = await this.scopesService.listScopes(filters, req.user);
            sendSuccess(res, { scopes });
        } catch (err) { next(err); }
    };

    // DELETE /viewer-scopes/:scopeId
    revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) return next(new UnauthorizedError());
            await this.scopesService.revokeScope(req.params['scopeId'] as string, req.user);
            sendSuccess(res, null, 200);
        } catch (err) { next(err); }
    };
}

