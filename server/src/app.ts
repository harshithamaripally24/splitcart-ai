import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.config';
import { v1Router } from './routes/v1.routes';
import { globalErrorHandler } from './middleware/error-handler.middleware';

export const app = express();
app.set('trust proxy', 1);

app.use(cors({ origin: ENV.ALLOWED_ORIGINS }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', v1Router);
app.use(globalErrorHandler);
