import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import logger from '../../utils/logger';
import { UPLOADS_DIR } from '../../config';

const router = Router();

router.get('/download/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error('Файл не найден:', err);
      return res.status(404).send('Файл не найден');
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        logger.error('Ошибка при скачивании файла:', err);
        res.status(500).send('Ошибка при скачивании файла');
      }
    });
  });
});

router.get('/files', async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(UPLOADS_DIR);

    const fileList = [];

    for (const file of files) {
      if (file.startsWith('.')) {
        continue;
      }

      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        fileList.push({
          name: file,
          size: stats.size,
          lastModified: stats.mtime,
        });
      } else {
        logger.info(`Пропускаем не файл: ${file}`);
      }
    }

    res.json(fileList);
  } catch (err) {
    logger.error('Ошибка при получении списка файлов:', err);
    res.status(500).send('Не удалось получить список файлов');
  }
});

router.get('/ping', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

export default router;
