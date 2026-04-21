import sql from 'mssql';
import { env } from './env.js';

const dbConfig: sql.config = {
    server: env.dbServer,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    options: {
        encrypt: env.dbEncrypt,
        trustServerCertificate: env.dbTrustServerCertificate
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool: sql.ConnectionPool | null = null;

export async function connectToDatabase(): Promise<sql.ConnectionPool> {
    if (pool) {
        return pool;
    }

    pool = await sql.connect(dbConfig);
    return pool;
}

export async function getDb(): Promise<sql.ConnectionPool> {
    if (!pool) {
        pool = await connectToDatabase();
    }

    return pool;
}

export async function closeDatabaseConnection(): Promise<void> {
    if (pool) {
        await pool.close();
        pool = null;
    }
}
