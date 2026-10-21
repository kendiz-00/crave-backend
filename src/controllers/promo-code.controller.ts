import { Request, Response, NextFunction } from 'express';
import { promoCodeService } from '../services/promo-code.service';
import { CreatePromoCodeInput, UpdatePromoCodeInput, ValidatePromoCodeInput } from '../validators/promo-code.validator';

export class PromoCodeController {
  /**
   * Create a new promo code (admin only)
   */
  async createPromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const data: CreatePromoCodeInput = req.body;
      const promoCode = await promoCodeService.createPromoCode(adminUserId, data);

      res.status(201).json(promoCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a promo code (admin only)
   */
  async updatePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { codeId } = req.params;
      const data: UpdatePromoCodeInput = req.body;
      const promoCode = await promoCodeService.updatePromoCode(adminUserId, codeId, data);

      res.json(promoCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a promo code (admin only)
   */
  async deletePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { codeId } = req.params;
      const result = await promoCodeService.deletePromoCode(adminUserId, codeId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all promo codes (admin only)
   */
  async getAllPromoCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const promoCodes = await promoCodeService.getAllPromoCodes(adminUserId);

      res.json(promoCodes);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single promo code by ID (admin only)
   */
  async getPromoCodeById(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { codeId } = req.params;
      const promoCode = await promoCodeService.getPromoCodeById(adminUserId, codeId);

      res.json(promoCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate a promo code for checkout (public)
   */
  async validatePromoCode(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ValidatePromoCodeInput = req.body;
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      const result = await promoCodeService.validatePromoCode({
        ...data,
        userId,
        userEmail,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const promoCodeController = new PromoCodeController();
