import { Router } from 'express';
import { promoCodeController } from '../controllers/promo-code.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorization.middleware';

const router = Router();

// Admin-only routes (require ADMIN or OWNER role)
router.post('/admin/promo-codes', authenticate, authorize('ADMIN', 'OWNER'), promoCodeController.createPromoCode.bind(promoCodeController));
router.get('/admin/promo-codes', authenticate, authorize('ADMIN', 'OWNER'), promoCodeController.getAllPromoCodes.bind(promoCodeController));
router.get('/admin/promo-codes/:codeId', authenticate, authorize('ADMIN', 'OWNER'), promoCodeController.getPromoCodeById.bind(promoCodeController));
router.put('/admin/promo-codes/:codeId', authenticate, authorize('ADMIN', 'OWNER'), promoCodeController.updatePromoCode.bind(promoCodeController));
router.delete('/admin/promo-codes/:codeId', authenticate, authorize('ADMIN', 'OWNER'), promoCodeController.deletePromoCode.bind(promoCodeController));

// Public route for validation (no auth required for guest checkout)
router.post('/promo-codes/validate', promoCodeController.validatePromoCode.bind(promoCodeController));

export default router;
