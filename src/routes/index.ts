import { Router } from 'express';
import rootRoute from '@/routes/root.route';
import healthRoute from '@/routes/health.route';
import apiRoute from '@/routes/api.route';
import authRoute from '@/routes/auth.route';

const router = Router();

router.use('/', rootRoute);
router.use('/', healthRoute);
router.use('/', apiRoute);
router.use('/api/auth', authRoute);

export default router;
