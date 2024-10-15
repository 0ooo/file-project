import fs from 'fs-extra';
import path from 'path';
import logger from './logger';
import { CLEANUP_INTERVAL, MAX_AGE, UPLOADS_DIR } from '../config';

const TEMP_DIR = UPLOADS_DIR;

export const cleanupTempDirectories = () => {
  setInterval(() => {
    if (!fs.existsSync(TEMP_DIR)) {
      return;
    }

    fs.readdir(TEMP_DIR, (err, files) => {
      if (err) {
        logger.error('Ошибка при чтении директории для очистки:', err);
        return;
      }

      files.forEach((file) => {
        const filePath = path.join(TEMP_DIR, file);

        fs.stat(filePath, (err, stats) => {
          if (err) {
            logger.error('Ошибка при получении информации о файле:', err);
            return;
          }

          if (stats.isDirectory()) {
            const now = Date.now();
            const modificationTime = new Date(stats.mtime).getTime();

            if (now - modificationTime > MAX_AGE) {
              fs.remove(filePath, (err) => {
                if (err) {
                  logger.error(
                    'Ошибка при удалении временной директории:',
                    err
                  );
                } else {
                  logger.info(`Временная директория ${file} успешно удалена`);
                }
              });
            }
          }
        });
      });
    });
  }, CLEANUP_INTERVAL);
};
