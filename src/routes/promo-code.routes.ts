import { Router } from 'express';
import { promoCodeController } from '../controllers/promo-code.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Admin-only routes
router.post('/admin/promo-codes', authenticate, promoCodeController.createPromoCode.bind(promoCodeController));
router.get('/admin/promo-codes', authenticate, promoCodeController.getAllPromoCodes.bind(promoCodeController));
router.get('/admin/promo-codes/:codeId', authenticate, promoCodeController.getPromoCodeById.bind(promoCodeController));
router.put('/admin/promo-codes/:codeId', authenticate, promoCodeController.updatePromoCode.bind(promoCodeController));
router.delete('/admin/promo-codes/:codeId', authenticate, promoCodeController.deletePromoCode.bind(promoCodeController));

// Public route for validation
router.post('/promo-codes/validate', promoCodeController.validatePromoCode.bind(promoCodeController));

export default router;
