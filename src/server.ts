import 'dotenv/config';
import app from './app.js';
import { env } from './config/env.js';
import { connectToDatabase } from './config/database.js';

async function bootstrap(): Promise<void> {
    try {
        await connectToDatabase();
        console.log('Database connected successfully');

        app.listen(env.port, () => {
            console.log(`Server running on http://localhost:${env.port}`);
        });
    } catch (error) {
        console.error('Failed to start server', error);
        process.exit(1);
    }
}

void bootstrap();
