import { PrismaClient, OrderStatus, PaymentStatus, OrderType, RewardTransactionType } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CreateOrderInput, UpdateOrderStatusInput, UpdatePaymentStatusInput } from '../validators';
import { cartService } from './cart.service';

const prisma = new PrismaClient();

export class OrderService {
  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `CRV-${year}-${random}`;
  }

  /**
   * Create order from cart
   */
  async createOrder(userId: string, data: CreateOrderInput) {
    // Get active cart
    const cart = await cartService.getActiveCart(userId);

    if (cart.items.length === 0) {
      throw new ApiError(400, 'Cart is empty');
    }

    // Validate cart items before checkout
    await this.validateCartItems(cart.items);

    // Validate reward code if provided
    let discount = 0;
    let rewardCodeUsed = null;
    if (data.rewardCodeUsed) {
      const rewardCode = await prisma.rewardCode.findUnique({
        where: { code: data.rewardCodeUsed },
      });

      // Validate reward code exists
      if (!rewardCode) {
        throw new ApiError(400, 'Invalid reward code');
      }

      // Validate reward code status
      if (rewardCode.status !== 'GENERATED') {
        throw new ApiError(400, 'Reward code has already been used or is invalid');
      }

      // Validate reward code ownership
      if (rewardCode.userId !== userId) {
        throw new ApiError(403, 'You do not have permission to use this reward code');
      }

      // Validate reward code not expired
      if (new Date(rewardCode.expiresAt) < new Date()) {
        throw new ApiError(400, 'Reward code has expired');
      }

      // Validate reward code uniqueness (not already used in another order)
      if (rewardCode.orderId) {
        throw new ApiError(400, 'Reward code has already been used');
      }

      // Apply discount (simplified - in production, this would be more complex)
      discount = 10; // GHS 10 discount for reward
      rewardCodeUsed = rewardCode.code;
    }

    // Calculate totals (backend recalculation to prevent price tampering)
    const cartTotal = await this.calculateCartTotalFromItems(cart.items);
    const subtotal = cartTotal.subtotal;
    const tax = subtotal * 0.05; // 5% tax
    const deliveryFee = data.orderType === OrderType.DELIVERY ? 15 : 0; // GHS 15 for delivery
    const grandTotal = subtotal - discount + tax + deliveryFee;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          orderType: data.orderType,
          subtotal,
          discount,
          tax,
          deliveryFee,
          grandTotal,
          rewardCodeUsed,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          deliveryAddress: data.deliveryAddress,
          latitude: data.latitude,
          longitude: data.longitude,
          notes: data.notes,
          items: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: cart.items.map((item: any) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              snapshotName: item.menuItem.name,
              snapshotPrice: item.menuItem.price,
              snapshotImage: item.menuItem.imageUrl,
              snapshotSku: item.menuItem.sku,
              subtotal: item.totalPrice,
              addOns: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                create: item.addOns?.map((a: any) => ({
                  name: a.name,
                  snapshotPrice: a.price,
                })) || [],
              },
            })),
          },
        },
        include: {
          items: {
            include: {
              addOns: true,
            },
          },
        },
      });

      // Mark reward code as used if applicable
      if (rewardCodeUsed) {
        await tx.rewardCode.update({
          where: { code: rewardCodeUsed },
          data: { 
            status: 'REDEEMED',
            orderId: newOrder.id,
            redeemedAt: new Date(),
          },
        });
      }

      // Mark cart as checked out
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CHECKED_OUT' },
      });

      // Award reward points (1 point per GHS spent)
      const pointsEarned = Math.floor(grandTotal);
      await this.createRewardTransaction(
        tx,
        userId,
        newOrder.id,
        RewardTransactionType.EARN,
        pointsEarned,
        'Order completed',
      );

      // Generate reward code for customer
      const rewardCode = await this.generateRewardCode(tx);
      await tx.order.update({
        where: { id: newOrder.id },
        data: { rewardCodeGenerated: rewardCode.code, rewardPointsEarned: pointsEarned },
      });

      return { ...newOrder, rewardCodeGenerated: rewardCode.code };
    });

    return order;
  }

  /**
   * Validate cart items before checkout
   */
  private async validateCartItems(items: any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const item of items) {
      // Validate quantity
      if (item.quantity <= 0) {
        throw new ApiError(400, 'Item quantity must be greater than zero');
      }

      // Check if menu item exists and is available
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });

      if (!menuItem) {
        throw new ApiError(400, `Menu item ${item.menuItem.name} no longer exists`);
      }

      if (!menuItem.isAvailable) {
        throw new ApiError(400, `Menu item ${item.menuItem.name} is currently unavailable`);
      }

      // Validate add-ons
      if (item.addOns && item.addOns.length > 0) {
        const addOnIds = item.addOns.map((a: any) => a.addOnId);
        const validAddOns = await prisma.addOn.findMany({
          where: { id: { in: addOnIds } },
        });

        if (validAddOns.length !== addOnIds.length) {
          throw new ApiError(400, 'One or more add-ons are invalid or no longer available');
        }

        // Check for duplicate add-ons
        const uniqueAddOnIds = new Set(addOnIds);
        if (uniqueAddOnIds.size !== addOnIds.length) {
          throw new ApiError(400, 'Duplicate add-ons detected');
        }
      }
    }
  }

  /**
   * Calculate cart total from items (backend recalculation)
   */
  private async calculateCartTotalFromItems(items: any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    let subtotal = 0;

    for (const item of items) {
      // Get fresh menu item data from database
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });

      if (!menuItem) {
        throw new ApiError(400, `Menu item no longer exists`);
      }

      // Calculate unit price from database (never trust frontend)
      const unitPrice = Number(menuItem.price);

      // Calculate add-ons price from database
      let addOnsPrice = 0;
      if (item.addOns && item.addOns.length > 0) {
        const addOnIds = item.addOns.map((a: any) => a.addOnId);
        const addOns = await prisma.addOn.findMany({
          where: { id: { in: addOnIds } },
        });

        addOnsPrice = addOns.reduce((sum: number, a: any) => sum + Number(a.price), 0);
      }

      const itemTotal = (unitPrice + addOnsPrice) * item.quantity;
      subtotal += itemTotal;
    }

    return { subtotal };
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, userId: string, userRole: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            addOns: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Check ownership (customers can only see their own orders)
    if (userRole === 'CUSTOMER' && order.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    return order;
  }

  /**
   * Get all orders (admin/staff only)
   */
  async getAllOrders(userRole: string, page = 1, limit = 20, status?: OrderStatus) {
    if (userRole === 'CUSTOMER') {
      throw new ApiError(403, 'Access denied');
    }

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              addOns: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string, page = 1, limit = 20) {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              addOns: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, data: UpdateOrderStatusInput, userRole: string) {
    if (userRole === 'CUSTOMER') {
      throw new ApiError(403, 'Access denied');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['OUT_FOR_DELIVERY', 'COMPLETED'],
      OUT_FOR_DELIVERY: ['COMPLETED'],
      COMPLETED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!validTransitions[order.status].includes(data.status)) {
      throw new ApiError(400, `Cannot transition from ${order.status} to ${data.status}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { status: data.status },
      include: {
        items: {
          include: {
            addOns: true,
          },
        },
      },
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(orderId: string, data: UpdatePaymentStatusInput, userRole: string) {
    if (userRole === 'CUSTOMER') {
      throw new ApiError(403, 'Access denied');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: data.paymentStatus },
      include: {
        items: {
          include: {
            addOns: true,
          },
        },
      },
    });
  }

  /**
   * Delete order (soft delete via cancellation)
   */
  async deleteOrder(orderId: string, userId: string, userRole: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Only customers can cancel their own orders, and only if pending
    if (userRole === 'CUSTOMER') {
      if (order.userId !== userId) {
        throw new ApiError(403, 'Access denied');
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new ApiError(400, 'Can only cancel pending orders');
      }
    }

    return this.updateOrderStatus(orderId, { status: OrderStatus.CANCELLED }, userRole);
  }

  /**
   * Create reward transaction
   */
  private async createRewardTransaction(
    tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    userId: string,
    orderId: string,
    type: string,
    points: number,
    reason: string,
  ) {
    // Get current balance
    const lastTransaction = await tx.rewardTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const runningBalance = (lastTransaction?.runningBalance || 0) + points;

    return tx.rewardTransaction.create({
      data: {
        userId,
        orderId,
        type,
        points,
        runningBalance,
        reason,
      },
    });
  }

  /**
   * Generate reward code
   */
  private async generateRewardCode(tx: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const code = this.generateRewardCodeString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days

    return tx.rewardCode.create({
      data: {
        code,
        reward: 'FREE DRINK',
        generatedAt: new Date(),
        expiresAt,
      },
    });
  }

  /**
   * Generate unique reward code string
   */
  private generateRewardCodeString(): string {
    const prefix = 'CRV-DRINK';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${suffix}`;
  }

  /**
   * Get user's reward balance
   */
  async getUserRewardBalance(userId: string) {
    const lastTransaction = await prisma.rewardTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return lastTransaction?.runningBalance || 0;
  }

  /**
   * Get user's reward history
   */
  async getUserRewardHistory(userId: string, page = 1, limit = 20) {
    const [transactions, total] = await Promise.all([
      prisma.rewardTransaction.findMany({
        where: { userId },
        include: {
          order: {
            select: {
              orderNumber: true,
              grandTotal: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rewardTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const orderService = new OrderService();
