import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/errors';

// Simple hardcoded promo codes for quick deployment
const PROMO_CODES: Record<string, { code: string; discountType: string; discountValue: number; active: boolean }> = {
  CORPERATE: {
    code: 'CORPERATE',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    active: true,
  },
  CRAVE15: {
    code: 'CRAVE15',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    active: true,
  },
};

export class SimplePromoController {
  /**
   * Validate promo code (simple implementation)
   */
  async validatePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;

      if (!code) {
        throw new ApiError(400, 'Promo code is required');
      }

      const promoCode = PROMO_CODES[code.toUpperCase()];

      if (!promoCode) {
        throw new ApiError(400, 'Invalid promo code');
      }

      if (!promoCode.active) {
        throw new ApiError(400, 'Promo code is not active');
      }

      // Calculate discount based on promo code percentage
      const discountAmount = promoCode.discountValue;

      res.json({
        valid: true,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        discountAmount: discountAmount,
        expiresAt: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const simplePromoController = new SimplePromoController();
