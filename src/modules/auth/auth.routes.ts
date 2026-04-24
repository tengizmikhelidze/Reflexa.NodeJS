import { Router } from 'express';
import { getDb } from '../../config/database.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { EmailService } from '../../shared/services/email.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import {
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    refreshTokenSchema,
} from './auth.validation.js';

/**
 * Builds the auth router with all dependencies composed inline.
 * Called once at app startup — getDb() returns the existing pool singleton.
 */
export async function createAuthRouter(): Promise<Router> {
    const pool = await getDb();

    const usersRepo = new UsersRepository(pool);
    const authRepo = new AuthRepository(pool);
    const emailService = new EmailService();
    const authService = new AuthService(usersRepo, authRepo, emailService);
    const controller = new AuthController(authService);

    const router = Router();

    // ── Public routes ──────────────────────────────────────────────────────────
    router.post('/register',      validate(registerSchema),     controller.register);
    router.post('/login',         validate(loginSchema),        controller.login);
    router.post('/verify-email',  validate(verifyEmailSchema),  controller.verifyEmail);
    router.post('/refresh-token', validate(refreshTokenSchema), controller.refreshToken);
    router.post('/logout',        validate(refreshTokenSchema), controller.logout);

    // ── Protected routes ───────────────────────────────────────────────────────
    router.get('/me', authMiddleware, controller.getMe);

    return router;
}

