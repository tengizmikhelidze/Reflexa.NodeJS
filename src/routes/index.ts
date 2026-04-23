import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createOrganizationsRouter } from '../modules/organizations/organizations.routes.js';
import { createDevicesRouter } from '../modules/devices/devices.routes.js';
import { createSessionsRouter } from '../modules/sessions/sessions.routes.js';
import { createPresetsRouter } from '../modules/presets/presets.routes.js';
import { createTeamsRouter } from '../modules/teams/teams.routes.js';
import { createViewerScopesRouter } from '../modules/viewer_scopes/viewer-scopes.routes.js';

export async function createApiRouter(): Promise<Router> {
    const router = Router();

    router.get('/', (_req, res) => {
        res.json({ message: 'API root' });
    });

    router.get('/health', getHealth);

    // Auth — mounted at /api/auth
    const authRouter = await createAuthRouter();
    router.use('/auth', authRouter);

    // Organizations — mounted at /api/organizations
    const orgsRouter = await createOrganizationsRouter();
    router.use('/organizations', orgsRouter);

    // Devices — mounted at /api/devices
    const devicesRouter = await createDevicesRouter();
    router.use('/devices', devicesRouter);

    // Sessions — mounted at /api/sessions
    const sessionsRouter = await createSessionsRouter();
    router.use('/sessions', sessionsRouter);

    // Presets — mounted at /api/presets
    const presetsRouter = await createPresetsRouter();
    router.use('/presets', presetsRouter);

    // Teams — mounted at /api/teams
    const teamsRouter = await createTeamsRouter();
    router.use('/teams', teamsRouter);

    // Viewer Scopes — mounted at /api/viewer-scopes
    const viewerScopesRouter = await createViewerScopesRouter();
    router.use('/viewer-scopes', viewerScopesRouter);

    return router;
}
