import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createOrganizationsRouter } from '../modules/organizations/organizations.routes.js';
import { createDevicesRouter } from '../modules/devices/devices.routes.js';

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

    return router;
}
