import { Request, Response } from 'express';
import { orderService } from '../services';
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema, createRewardTransactionForUserSchema, claimRewardSchema } from '../validators';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '@/types/errors';
import { config } from '@/config';
import {
  ELIGIBLE_FREE_DRINK_IDS,
  PROPOSED_ELIGIBLE_FREE_DRINKS,
  IS_FREE_DRINK_REDEMPTION_ENABLED,
  RESERVATION_EXPIRATION_MS,
} from '../services/order.service';

export class OrderController {
  /**
   * POST /checkout
   * Create order from cart
   */
  checkout = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const data = createOrderSchema.parse(req.body);

    const order = await orderService.createOrder(userId, data);

    // Generate WhatsApp payload
    const whatsappPayload = this.generateWhatsAppPayload(order);

    res.status(201).json({
      success: true,
      data: order,
      whatsapp: whatsappPayload,
    });
  });

  /**
   * POST /orders
   * Create order (alias for checkout)
   */
  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const data = createOrderSchema.parse(req.body);

    const order = await orderService.createOrder(userId, data);

    const whatsappPayload = this.generateWhatsAppPayload(order);

    res.status(201).json({
      success: true,
      data: order,
      whatsapp: whatsappPayload,
    });
  });

  /**
   * GET /orders
   * Get all orders (admin/staff only)
   */
  getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    // Validate and parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string;

    const result = await orderService.getAllOrders(req.user?.role || 'CUSTOMER', page, limit, status as 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | undefined);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * GET /orders/my-orders
   * Get current user's orders
   */
  getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    // Validate and parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await orderService.getUserOrders(userId, page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * GET /orders/:id
   * Get order by ID
   */
  getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const orderId = req.params.id;

    const order = await orderService.getOrderById(orderId, userId, userRole);

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  /**
   * PATCH /orders/:id/status
   * Update order status (admin/staff only)
   */
  updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    const data = updateOrderStatusSchema.parse(req.body);

    const order = await orderService.updateOrderStatus(orderId, data, req.user?.role || 'CUSTOMER');

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  /**
   * PATCH /orders/:id/payment
   * Update payment status (admin/staff only)
   */
  updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    const data = updatePaymentStatusSchema.parse(req.body);

    const order = await orderService.updatePaymentStatus(orderId, data, req.user?.role || 'CUSTOMER');

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  /**
   * DELETE /orders/:id
   * Cancel/delete order
   */
  deleteOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const orderId = req.params.id;

    const order = await orderService.deleteOrder(orderId, userId, userRole);

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  /**
   * GET /rewards/balance
   * Get user's reward balance
   */
  getRewardBalance = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const balance = await orderService.getUserRewardBalance(userId);

    res.status(200).json({
      success: true,
      data: { balance },
    });
  });

  /**
   * GET /rewards/history
   * Get user's reward history
   */
  getRewardHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    // Validate and parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await orderService.getUserRewardHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * GET /rewards
   * Get user's full reward state
   */
  getRewards = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const rewards = await orderService.getUserFullRewards(userId);

    res.status(200).json({
      success: true,
      data: rewards,
    });
  });

  /**
   * GET /rewards/eligible-drinks
   * Return the backend-controlled list of eligible drink names for the 100-point milestone.
   * The frontend must consume this list and must not maintain a conflicting local copy.
   */
  getEligibleDrinks = asyncHandler(async (_req: Request, res: Response) => {
    const isEnabled = IS_FREE_DRINK_REDEMPTION_ENABLED;
    res.status(200).json({
      success: true,
      data: {
        rewardId: 'milestone_free_drink_100',
        redemptionEnabled: isEnabled,
        isApproved: isEnabled,
        status: isEnabled ? 'ACTIVE' : 'PENDING_BUSINESS_APPROVAL',
        code: isEnabled ? 'REDEMPTION_ACTIVE' : 'REWARD_REDEMPTION_DISABLED',
        message: isEnabled
          ? 'Free drink reward redemption is active'
          : 'Free drink reward redemption is currently disabled pending business activation.',
        eligibleProductIds: isEnabled ? ELIGIBLE_FREE_DRINK_IDS : [],
        eligibleDrinks: isEnabled ? PROPOSED_ELIGIBLE_FREE_DRINKS.map((d) => d.name) : [],
        items: isEnabled ? PROPOSED_ELIGIBLE_FREE_DRINKS : [],
        proposedItems: PROPOSED_ELIGIBLE_FREE_DRINKS,
      },
    });
  });

  /**
   * GET /rewards/redemption-status
   * Administrative verification mechanism to inspect free drink redemption feature flag status
   * without exposing secret configuration keys or environment credentials.
   */
  getRedemptionStatus = asyncHandler(async (_req: Request, res: Response) => {
    const isEnabled = IS_FREE_DRINK_REDEMPTION_ENABLED;
    res.status(200).json({
      success: true,
      data: {
        redemptionEnabled: isEnabled,
        status: isEnabled ? 'ACTIVE' : 'DISABLED',
        code: isEnabled ? 'REDEMPTION_ACTIVE' : 'REWARD_REDEMPTION_DISABLED',
        message: isEnabled
          ? 'Customer free-drink redemption is currently ENABLED.'
          : 'Customer free-drink redemption is currently DISABLED (Rollout Stage 1 / Non-negotiable control).',
        reservationTtlSeconds: RESERVATION_EXPIRATION_MS / 1000,
        proposedEligibleDrinksCount: PROPOSED_ELIGIBLE_FREE_DRINKS.length,
        featureFlagSource: 'REWARDS_FREE_DRINK_REDEMPTION_ENABLED',
      },
    });
  });

  /**
   * POST /rewards/transactions
   * Create a reward transaction for the authenticated user
   */
  createRewardTransaction = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = createRewardTransactionForUserSchema.parse(req.body);

    const result = await orderService.createRewardTransactionForUser(
      userId,
      data.type,
      data.points,
      data.reason,
      data.orderId || null,
      data.referenceId || null,
    );

    res.status(201).json({
      success: true,
      data: {
        transaction: result.transaction,
        newBalance: result.newBalance,
        previousBalance: result.previousBalance,
      },
    });
  });

  /**
   * POST /rewards/claims
   * Claim a milestone reward for the authenticated user
   */
  claimReward = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = claimRewardSchema.parse(req.body);

    const claim = await orderService.claimReward(userId, data.rewardId);

    res.status(201).json({
      success: true,
      data: claim,
    });
  });

  /**
   * Generate WhatsApp message payload
   */
  private generateWhatsAppPayload(order: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const items = order.items.map((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let itemText = `${item.quantity}x ${item.snapshotName} - GHS ${item.snapshotPrice}`;
      if (item.addOns && item.addOns.length > 0) {
        const addOnsText = item.addOns.map((a: { name: string; snapshotPrice: number }) => `+ ${a.name} (GHS ${a.snapshotPrice})`).join(', ');
        itemText += `\n  ${addOnsText}`;
      }
      return itemText;
    }).join('\n');

    const message = `
*NEW ORDER - CRAVE*
Order Number: ${order.orderNumber}
Customer: ${order.customerName}
Phone: ${order.customerPhone}
Order Type: ${order.orderType}

*Items:*
${items}

*Summary:*
Subtotal: GHS ${order.subtotal}
Discount: GHS ${order.discount}
Reward Points Used: ${order.rewardPointsUsed || 0} (-GHS ${order.rewardPointsUsed || 0})
Tax: GHS ${order.tax}
Delivery Fee: GHS ${order.deliveryFee}
Grand Total: GHS ${order.grandTotal}

Reward Points Earned: ${order.rewardPointsEarned}
Reward Code: ${order.rewardCodeGenerated}

Notes: ${order.notes || 'None'}
`.trim();

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = process.env.WHATSAPP_NUMBER || (config.isDevelopment || process.env.NODE_ENV === 'test' ? '+233200000000' : null);
    if (!phoneNumber) {
      throw new ApiError(500, 'WhatsApp number not configured');
    }
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    return {
      message,
      whatsappUrl,
      orderNumber: order.orderNumber,
      rewardCode: order.rewardCodeGenerated,
      rewardPoints: order.rewardPointsEarned,
      grandTotal: order.grandTotal,
    };
  }
}

export const orderController = new OrderController();
