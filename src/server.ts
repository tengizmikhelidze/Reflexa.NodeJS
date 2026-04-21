import 'dotenv/config';
import app, { mountRouter } from './app.js';
import { env } from './config/env.js';
import { connectToDatabase } from './config/database.js';
import { createApiRouter } from './routes/index.js';

async function bootstrap(): Promise<void> {
    try {
        await connectToDatabase();
        console.log('Database connected successfully');

        const apiRouter = await createApiRouter();
        mountRouter(apiRouter);

        app.listen(env.port, () => {
            console.log(`Server running on http://localhost:${env.port}`);
        });
    } catch (error) {
        console.error('Failed to start server', error);
        process.exit(1);
    }
}

void bootstrap();
