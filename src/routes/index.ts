import { Router } from 'express';
import rootRoute from '@/routes/root.route';
import healthRoute from '@/routes/health.route';
import apiRoute from '@/routes/api.route';
import authRoute from '@/routes/auth.route';
import menuRoute from '@/routes/menu.route';
import categoryRoute from '@/routes/category.route';
import cartRoute from '@/routes/cart.route';
import orderRoute from '@/routes/order.route';
import rewardRoute from '@/routes/reward.route';

const router = Router();

router.use('/', rootRoute);
router.use('/', healthRoute);
router.use('/', apiRoute);
router.use('/api/auth', authRoute);
router.use('/api/menu', menuRoute);
router.use('/api/categories', categoryRoute);
router.use('/api/cart', cartRoute);
router.use('/api/orders', orderRoute);
router.use('/api/rewards', rewardRoute);

export default router;
