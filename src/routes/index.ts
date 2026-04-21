import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

router.get('/', (_req, res) => {
    res.json({ message: 'API root' });
});

router.get('/health', getHealth);

export default router;
