import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import {errorMiddleware} from "./middlewares/error.middleware";

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api', apiRouter);
app.use(errorMiddleware);

export default app;
