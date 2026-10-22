import { Request, Response, NextFunction } from 'express';
import { guestOrderService } from '../services/guest-order.service';
import { CreateGuestOrderInput } from '../validators/guest-order.validator';

export class GuestOrderController {
  /**
   * Create a guest order (no authentication required)
   */
  async createGuestOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateGuestOrderInput = req.body;

      // Optional: Check if user is authenticated but don't require it
      const authenticatedUserId = req.user?.id;
      const authenticatedUserEmail = req.user?.email;

      // If authenticated user provided, validate it matches their identity
      if (data.userId && authenticatedUserId && data.userId !== authenticatedUserId) {
        return res.status(403).json({ error: 'Cannot impersonate another user' });
      }

      if (data.userEmail && authenticatedUserEmail && data.userEmail !== authenticatedUserEmail) {
        return res.status(403).json({ error: 'Cannot use another user\'s email' });
      }

      const result = await guestOrderService.createGuestOrder(data, authenticatedUserId, authenticatedUserEmail);

      // Return order details for WhatsApp message
      res.status(201).json({
        order: result.order,
        isDuplicate: result.isDuplicate,
        promoReservation: result.promoReservation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order by idempotency key
   */
  async getOrderByKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { idempotencyKey } = req.params;

      const order = await guestOrderService.getOrderByKey(idempotencyKey);

      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel guest order
   */
  async cancelGuestOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;

      const result = await guestOrderService.cancelGuestOrder(orderId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm guest order (restaurant confirmation)
   */
  async confirmGuestOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;

      const result = await guestOrderService.confirmGuestOrder(orderId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const guestOrderController = new GuestOrderController();
