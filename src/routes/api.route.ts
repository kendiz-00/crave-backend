import { Router } from 'express';
import { apiController } from '@/controllers/api.controller';

const router = Router();

router.get('/api', apiController);

export default router;
