import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess, sendSuccessWithMessage } from '../../shared/utils/response.js';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import {
    RegisterInput,
    LoginInput,
    VerifyEmailInput,
    RefreshTokenInput,
} from './auth.types.js';

export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // POST /auth/register
    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const input = req.body as RegisterInput;
            const result = await this.authService.register(input);
            sendSuccessWithMessage(res, { user: result.user }, result.message, 201);
        } catch (err) {
            next(err);
        }
    };

    // POST /auth/login
    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const input = req.body as LoginInput;
            const result = await this.authService.login(input);
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    };

    // POST /auth/verify-email
    verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { token } = req.body as VerifyEmailInput;
            await this.authService.verifyEmail(token);
            sendSuccess(res, { message: 'Email verified successfully.' });
        } catch (err) {
            next(err);
        }
    };

    // POST /auth/refresh-token
    refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const input = req.body as RefreshTokenInput;
            const result = await this.authService.refreshToken(input);
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    };

    // POST /auth/logout
    logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { refreshToken } = req.body as RefreshTokenInput;
            await this.authService.logout(refreshToken);
            sendSuccess(res, { message: 'Logged out successfully.' });
        } catch (err) {
            next(err);
        }
    };

    // GET /auth/me  (protected)
    getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                return next(new UnauthorizedError('Not authenticated.'));
            }
            const user = await this.authService.getMe(req.user.userId);
            sendSuccess(res, { user });
        } catch (err) {
            next(err);
        }
    };
}

