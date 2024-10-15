import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

const MB = 1024 * 1024;

export const PORT = process.env.PORT || 3002;
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const MAX_CHUNK_SIZE =
  parseInt(process.env.MAX_CHUNK_SIZE_MB || '100') * MB;
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '2') * MB;

export const CLEANUP_INTERVAL = parseInt(
  process.env.CLEANUP_INTERVAL_MS || '60000'
);
export const MAX_AGE = parseInt(process.env.MAX_AGE_MS || '300000');
