import { Router } from 'express';
import { healthController } from '@/controllers/health.controller';
import { asyncHandler } from '@/middleware/asyncHandler';

const router = Router();

router.get('/health', asyncHandler(healthController));

export default router;
