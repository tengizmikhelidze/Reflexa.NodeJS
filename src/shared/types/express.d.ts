import { AuthUser } from './auth-user.types';

declare global {
    namespace Express {
        interface Request {
            /**
             * Set by authMiddleware after a valid JWT access token is verified.
             * Undefined on unauthenticated routes.
             */
            user?: AuthUser;
        }
    }
}

export {};

