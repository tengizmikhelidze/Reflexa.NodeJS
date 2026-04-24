import { Resend } from 'resend';
import { env } from '../../config/env.js';

const resend = new Resend(env.resendApiKey);

export class EmailService {
    async sendVerificationEmail(toEmail: string, token: string): Promise<void> {
        const verificationUrl = `${env.appUrl}/auth/verify-email?token=${token}`;

        await resend.emails.send({
            from: env.emailFrom,
            to: toEmail,
            subject: 'Verify your Reflexa account',
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                    <h2>Verify your email address</h2>
                    <p>Thanks for signing up! Click the button below to verify your email address. The link expires in ${env.emailVerificationTokenExpiresHours} hours.</p>
                    <a href="${verificationUrl}"
                       style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        Verify Email
                    </a>
                    <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
                        Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a>
                    </p>
                </div>
            `,
        });
    }
}
