import express, { Express, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes are mounted after async bootstrap (see server.ts)
export function mountRouter(router: Router): void {
    app.use('/api', router);
    app.use(errorMiddleware);
}

export default app;
