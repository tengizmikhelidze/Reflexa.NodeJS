import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess, sendSuccessWithMessage } from '../../shared/utils/response.js';
import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import {
    RegisterInput,
    LoginInput,
    VerifyEmailInput,
    RefreshTokenInput,
    ResendVerificationEmailInput,
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

    // POST /auth/resend-verification
    resendVerificationEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const input = req.body as ResendVerificationEmailInput;
            await this.authService.resendVerificationEmail(input);
            sendSuccess(res, {
                message: 'If that email is registered and unverified, a new verification link has been sent.',
            });
        } catch (err) {
            next(err);
        }
    };

    // GET /auth/verify-email?token=... (email link handler — returns HTML)
    verifyEmailViaLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { token } = req.query as unknown as VerifyEmailInput;
            await this.authService.verifyEmail(token);
            res.status(200).send(verifyEmailHtml(true));
        } catch {
            res.status(200).send(verifyEmailHtml(false));
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

function verifyEmailHtml(success: boolean): string {
    const title   = success ? 'Email Verified' : 'Verification Failed';
    const heading = success ? '✓ Email verified!' : '✗ Verification failed';
    const message = success
        ? 'Your email address has been confirmed. You can now log in.'
        : 'The link is invalid, already used, or has expired. Please request a new verification email.';
    const color   = success ? '#16a34a' : '#dc2626';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 420px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
    h1 { color: ${color}; font-size: 1.5rem; margin-bottom: 12px; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

