import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import logger from '../../utils/logger';
import { MAX_FILE_SIZE, UPLOADS_DIR } from '../../config';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOADS_DIR));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      logger.error(
        `Файл ${file.originalname} не был загружен: неверный формат`
      );
      cb(new Error('Разрешены только изображения формата JPEG и PNG'));
    }
  },
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

router.post(
  '/upload',
  upload.single('file'),
  (req: Request, res: Response): void => {
    if (!req.file) {
      logger.info('Файл не был загружен');
      res.status(400).send('Файл не был загружен');
      return;
    }

    logger.info(`Файл ${req.file.originalname} успешно загружен`);
    res.send(`Файл ${req.file.originalname} успешно загружен`);
  }
);

export default router;
