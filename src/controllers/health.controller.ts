import { Request, Response } from 'express';
import { getDb } from '../config/database.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
    try {
        const db = await getDb();
        const result = await db.request().query('SELECT 1 AS ok');

        res.status(200).json({
            success: true,
            app: 'Reflexa backend is running',
            database: result.recordset[0]?.ok === 1 ? 'connected' : 'unknown'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            app: 'Reflexa backend is running',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
