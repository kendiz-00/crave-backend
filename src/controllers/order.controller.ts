import { Request, Response } from 'express';
import { orderService } from '../services';
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema } from '../validators';
import { asyncHandler } from '../middleware/asyncHandler';

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
    const userRole = req.user?.role;
    if (!userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const result = await orderService.getAllOrders(userRole, page, limit, status as 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | undefined);

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

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
    const userRole = req.user?.role;
    if (!userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const orderId = req.params.id;
    const data = updateOrderStatusSchema.parse(req.body);

    const order = await orderService.updateOrderStatus(orderId, data, userRole);

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
    const userRole = req.user?.role;
    if (!userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const orderId = req.params.id;
    const data = updatePaymentStatusSchema.parse(req.body);

    const order = await orderService.updatePaymentStatus(orderId, data, userRole);

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await orderService.getUserRewardHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * Generate WhatsApp message payload
   */
  private generateWhatsAppPayload(order: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const items = order.items.map((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let itemText = `${item.quantity}x ${item.snapshotName} - GHS ${item.snapshotPrice}`;
      if (item.addOns && item.addOns.length > 0) {
        const addOnsText = item.addOns.map((a: any) => `+ ${a.name} (GHS ${a.snapshotPrice})`).join(', ');
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
Tax: GHS ${order.tax}
Delivery Fee: GHS ${order.deliveryFee}
Grand Total: GHS ${order.grandTotal}

Reward Points Earned: ${order.rewardPointsEarned}
Reward Code: ${order.rewardCodeGenerated}

Notes: ${order.notes || 'None'}
`.trim();

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = process.env.WHATSAPP_NUMBER || '233241234567';
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
