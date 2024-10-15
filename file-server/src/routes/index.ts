import { Router } from 'express';
import uploadRoutes from './uploads/uploadRoutes';
import chunkRoutes from './chunks/chunkRoutes';
import downloadRoutes from './downloads/downloadRoutes';

const router = Router();

router.use('/', uploadRoutes);
router.use('/', chunkRoutes);
router.use('/', downloadRoutes);

export default router;
