import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import routes from './routes';
import logger from './utils/logger';
import dotenv from 'dotenv';
import { cleanupTempDirectories } from './utils/cleanup';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { PORT } from './config';

dotenv.config();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});

app.use(limiter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).send('Внутренняя ошибка сервера');
});

app.use('/', routes);

app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`Сервер запущен на http://localhost:${PORT}`);
});

cleanupTempDirectories();
