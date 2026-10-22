import { Router } from 'express';
import { simplePromoController } from '../controllers/simple-promo.controller';

const router = Router();

/**
 * @route   POST /api/simple-promo/validate
 * @desc    Validate a simple promo code
 * @access  Public
 */
router.post('/validate', simplePromoController.validatePromoCode.bind(simplePromoController));

export default router;
