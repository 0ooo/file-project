import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import logger from '../../utils/logger';
import Joi from 'joi';
import { MAX_CHUNK_SIZE, UPLOADS_DIR } from '../../config';
import crc from 'crc';

const router = Router();

const storageChunks = multer.memoryStorage();
const uploadChunk = multer({
  storage: storageChunks,
  limits: { fileSize: MAX_CHUNK_SIZE },
});

const uploadChunkSchema = Joi.object({
  originalFilename: Joi.string().required(),
  chunkIndex: Joi.number().integer().min(0).required(),
  totalChunks: Joi.number().integer().min(1).required(),
  uploadId: Joi.string().required(),
  chunkCRC: Joi.string().required(),
});

const uploadCompleteSchema = Joi.object({
  originalFilename: Joi.string().required(),
  totalChunks: Joi.number().integer().min(1).required(),
  uploadId: Joi.string().required(),
});

router.post(
  '/upload-chunk',
  (req: Request, res: Response, next) => {
    uploadChunk.single('chunk')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        logger.error('Размер части превышает допустимый предел');
        return res.status(400).send('Размер части превышает допустимый предел');
      } else if (err) {
        logger.error('Ошибка при загрузке части файла:', err);
        return res.status(500).send('Ошибка при загрузке части файла');
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = uploadChunkSchema.validate(req.body);

    if (error) {
      logger.warn(`Некорректные данные: ${error.message}`);
      res.status(400).send(`Некорректные данные: ${error.message}`);
      return;
    }

    const { originalFilename, chunkIndex, totalChunks, uploadId, chunkCRC } =
      value;
    const chunkBuffer = req.file?.buffer;

    if (!chunkBuffer) {
      res.status(400).send('Файл чанка отсутствует');
      return;
    }

    const serverChunkCRC = crc.crc32(chunkBuffer).toString(16);

    if (chunkCRC !== serverChunkCRC) {
      logger.warn(
        `Контрольная сумма чанка не совпадает (ожидалось: ${chunkCRC}, получено: ${serverChunkCRC})`
      );
      res.status(400).send('Контрольная сумма чанка не совпадает');
      return;
    }

    const uploadDir = path.join(UPLOADS_DIR, uploadId);
    const chunkFilename = path.join(uploadDir, `chunk_${chunkIndex}`);

    await fs.ensureDir(uploadDir);

    if (await fs.pathExists(chunkFilename)) {
      logger.info(`Часть ${chunkIndex} уже загружена`);
      res.send(`Часть ${chunkIndex} уже загружена`);
      return;
    }

    try {
      await fs.writeFile(chunkFilename, chunkBuffer);

      await fs.utimes(uploadDir, new Date(), new Date());

      logger.info(`Часть ${chunkIndex} из ${totalChunks} успешно загружена`);
      res.send(`Часть ${chunkIndex} из ${totalChunks} успешно загружена`);
    } catch (err) {
      logger.error('Ошибка при сохранении части файла:', err);
      res.status(500).send('Ошибка при сохранении части файла');
    }
  }
);

router.post(
  '/upload-complete',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = uploadCompleteSchema.validate(req.body);

      if (error) {
        logger.warn(`Некорректные данные: ${error.message}`);
        res.status(400).send(`Некорректные данные: ${error.message}`);
        return;
      }

      const { originalFilename, totalChunks, uploadId } = value;
      const totalChunksNum = totalChunks;

      if (isNaN(totalChunksNum) || totalChunksNum <= 0) {
        logger.error('Некорректное количество частей');
        res.status(400).send('Некорректное количество частей');
        return;
      }

      const uploadDir = path.join(UPLOADS_DIR, uploadId);
      const filePath = path.join(UPLOADS_DIR, originalFilename);

      if (!fs.existsSync(uploadDir)) {
        logger.error('Чанки для данной загрузки отсутствуют');
        res.status(400).send('Чанки для данной загрузки отсутствуют');
        return;
      }

      for (let i = 0; i < totalChunksNum; i++) {
        const chunkFilename = path.join(uploadDir, `chunk_${i}`);
        if (!fs.existsSync(chunkFilename)) {
          logger.error(`Часть ${i} отсутствует. Сборка файла невозможна.`);
          res
            .status(400)
            .send(`Часть ${i} отсутствует. Сборка файла невозможна.`);
          return;
        }

        const stats = fs.statSync(chunkFilename);
        if (stats.size === 0) {
          logger.error(`Часть ${i} пуста. Сборка файла невозможна.`);
          res.status(400).send(`Часть ${i} пуста. Сборка файла невозможна.`);
          return;
        }
      }

      const writeStream = fs.createWriteStream(filePath);
      let currentChunk = 0;

      const appendNextChunk = () => {
        if (currentChunk >= totalChunksNum) {
          writeStream.end();

          fs.removeSync(uploadDir);
          logger.info('Файл успешно собран');
          return res.send('Файл успешно собран');
        }

        const chunkFilename = path.join(uploadDir, `chunk_${currentChunk}`);
        const readStream = fs.createReadStream(chunkFilename);

        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          currentChunk++;
          appendNextChunk();
        });
        readStream.on('error', (err) => {
          logger.error('Ошибка при сборке файла:', err);
          return res.status(500).send('Ошибка при сборке файла');
        });
      };

      appendNextChunk();
    } catch (err) {
      logger.error('Ошибка при сборке файла:', err);
      res.status(500).send('Внутренняя ошибка сервера');
    }
  }
);

router.get('/upload-status', (req: Request, res: Response) => {
  const { uploadId } = req.query as { uploadId: string };

  (async () => {
    try {
      const uploadDir = path.join(UPLOADS_DIR, uploadId);

      if (!(await fs.pathExists(uploadDir))) {
        return res.json({ uploadedChunks: [] });
      }

      const files = await fs.readdir(uploadDir);

      const uploadedChunks = files
        .filter((file) => file.startsWith('chunk_'))
        .map((file) => parseInt(file.split('_')[1]));

      return res.json({ uploadedChunks });
    } catch (err) {
      logger.error('Ошибка при получении статуса загрузки:', err);

      if (!res.headersSent) {
        res.status(500).send('Ошибка при получении статуса загрузки');
      } else {
        return;
      }
    }
  })();
});

export default router;
