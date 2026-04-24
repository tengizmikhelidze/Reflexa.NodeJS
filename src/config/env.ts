import 'dotenv/config';

function getEnv(name: string, defaultValue?: string): string {
    const value = process.env[name] ?? defaultValue;

    if (value === undefined || value === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export const env = {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    port: Number(getEnv('PORT', '3000')),

    dbServer: getEnv('DB_SERVER'),
    dbPort: Number(getEnv('DB_PORT', '1433')),
    dbName: getEnv('DB_NAME'),
    dbUser: getEnv('DB_USER'),
    dbPassword: getEnv('DB_PASSWORD'),
    dbEncrypt: getEnv('DB_ENCRYPT', 'true') === 'true',
    dbTrustServerCertificate:
        getEnv('DB_TRUST_SERVER_CERTIFICATE', 'true') === 'true',

    jwtAccessSecret: getEnv('JWT_ACCESS_SECRET'),
    jwtRefreshSecret: getEnv('JWT_REFRESH_SECRET'),
    jwtAccessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

    emailVerificationTokenExpiresHours: Number(
        getEnv('EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS', '24')
    ),
    bcryptSaltRounds: Number(getEnv('BCRYPT_SALT_ROUNDS', '12')),

    resendApiKey: getEnv('RESEND_API_KEY'),
    emailFrom: getEnv('EMAIL_FROM', 'noreply@reflexa.app'),
    appUrl: getEnv('APP_URL', 'http://localhost:3000'),
};
