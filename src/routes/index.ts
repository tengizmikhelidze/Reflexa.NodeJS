import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';

export async function createApiRouter(): Promise<Router> {
    const router = Router();

    router.get('/', (_req, res) => {
        res.json({ message: 'API root' });
    });

    router.get('/health', getHealth);

    // Auth — all routes mounted at /api/auth
    const authRouter = await createAuthRouter();
    router.use('/auth', authRouter);

    return router;
}
