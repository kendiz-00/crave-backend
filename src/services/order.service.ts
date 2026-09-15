import { PrismaClient, OrderStatus, PaymentStatus, OrderType, RewardTransactionType } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CreateOrderInput, UpdateOrderStatusInput, UpdatePaymentStatusInput } from '../validators';
import { cartService } from './cart.service';

const prisma = new PrismaClient();

const MILESTONE_CONFIG: Record<string, { points: number; name: string; categories?: string[]; names?: string[] }> = {
  milestone_free_drink_100: {
    points: 100,
    name: 'Free Drink',
    categories: ['smoothies'],
    names: [
      'Strawberry Colada',
      'Pina Colada',
      'Watermelon Mint Ice',
      'Green Glow',
      'Green Glow Smoothie',
      'Tropical Fruit Blend',
      'Pineapple Strawberry',
      'Strawberries and Cream',
      'Lemonade Ice',
      'Banana Peanut Butter Chocolate',
    ],
  },
  milestone_free_dessert_250: {
    points: 250,
    name: 'Free Dessert',
    categories: ['cupcakes'],
    names: [
      'Chocolate Rich Buttercream Frosting Jar Cake',
      'Biscoff Jar Cake',
      'Lemon Buttercream Jar Cake',
      'Vanilla Buttercream Cake Slice',
      'Bailey\'s Irish Cream Jar Cake',
      'Salted Caramel Cake',
      'Pistachio Dream Jar Cake',
      'Coffee Latte Jar Cake',
    ],
  },
  milestone_free_loaded_fries_500: {
    points: 500,
    name: 'Free Loaded Fries',
    categories: ['loaded-fries'],
    names: [
      'Loaded Fries',
      'Cheese Beef Loaded Fries',
      'Loaded BBQ Chicken Cheddar Cheese Fries',
      'Bacon Cheddar Fries',
    ],
  },
  milestone_premium_combo_750: {
    points: 750,
    name: 'Premium Combo',
    categories: ['texas-crispy-chicken', 'jamaican-kitchen', 'burgers-combos'],
  },
  milestone_vip_reward_1000: {
    points: 1000,
    name: 'VIP Reward',
    categories: ['texas-crispy-chicken', 'jamaican-kitchen', 'mexican-food', 'breakfast', 'smoothies', 'cupcakes', 'loaded-fries'],
  },
};

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

    // Validate and process reward points redemption if provided
    let pointsDiscount = 0;
    let pointsRedeemed = 0;
    if (data.rewardPointsUsed && data.rewardPointsUsed > 0) {
      // Get user's current reward balance
      const currentBalance = await this.getUserRewardBalance(userId);
      
      // Validate user has enough points
      if (currentBalance < data.rewardPointsUsed) {
        throw new ApiError(400, 'Insufficient reward points');
      }
      
      // Calculate totals first to validate points don't exceed eligible amount
      const cartTotal = await this.calculateCartTotalFromItems(cart.items);
      const subtotal = cartTotal.subtotal;
      
      // Validate points don't exceed subtotal (1 point = 1 GHS)
      if (data.rewardPointsUsed > subtotal) {
        throw new ApiError(400, 'Reward points cannot exceed order subtotal');
      }
      
      // Validate points don't exceed 10% of eligible subtotal (redemption cap)
      const maxRedeemable = Math.floor(subtotal * 0.10);
      if (data.rewardPointsUsed > maxRedeemable) {
        throw new ApiError(400, `Maximum redeemable points is ${maxRedeemable} (10% of subtotal)`);
      }
      
      pointsDiscount = data.rewardPointsUsed;
      pointsRedeemed = data.rewardPointsUsed;
    }

    // Validate claimed milestone reward if provided
    let rewardDiscount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let validClaimToRedeem: any = null;
    if (data.claimedRewardId) {
      const claim = await prisma.rewardClaim.findFirst({
        where: { id: data.claimedRewardId, userId },
      });

      if (!claim) {
        throw new ApiError(400, 'Invalid reward claim');
      }

      if (claim.status !== 'CLAIMED') {
        throw new ApiError(400, 'Reward claim has already been redeemed or is invalid');
      }

      const milestoneConfig = MILESTONE_CONFIG[claim.rewardId];
      if (!milestoneConfig) {
        throw new ApiError(400, 'Unknown reward milestone');
      }

      // Find eligible cart item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let eligibleItem: any = null;
      for (const item of cart.items) {
        const catSlug = item.menuItem.category?.slug?.toLowerCase() || '';
        const itemName = item.menuItem.name;

        const catMatches = milestoneConfig.categories && milestoneConfig.categories.some(c => catSlug.includes(c.toLowerCase()));
        const nameMatches = milestoneConfig.names && milestoneConfig.names.some(n => n.toLowerCase() === itemName.toLowerCase());

        if (catMatches || nameMatches) {
          if (!eligibleItem || Number(item.menuItem.price) > Number(eligibleItem.menuItem.price)) {
            eligibleItem = item;
          }
        }
      }

      if (!eligibleItem) {
        throw new ApiError(400, `Your cart does not contain an item eligible for ${milestoneConfig.name}`);
      }

      // Calculate authoritative discount (price of 1 unit of eligible item)
      rewardDiscount = Number(eligibleItem.menuItem.price);
      validClaimToRedeem = claim;
    }

    // Calculate totals (backend recalculation to prevent price tampering)
    const cartTotal = await this.calculateCartTotalFromItems(cart.items);
    const subtotal = cartTotal.subtotal;
    const tax = subtotal * 0.05; // 5% tax
    const deliveryFee = data.orderType === OrderType.DELIVERY ? 15 : 0; // GHS 15 for delivery
    const totalDiscount = discount + pointsDiscount + rewardDiscount;
    const grandTotal = Math.max(0, subtotal - totalDiscount + tax + deliveryFee);

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Atomically claim cart from ACTIVE to CHECKED_OUT
      // This prevents concurrent checkout requests from creating duplicate orders
      const claimResult = await tx.cart.updateMany({
        where: {
          id: cart.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'CHECKED_OUT',
        },
      });

      if (claimResult.count !== 1) {
        throw new ApiError(400, 'Cart is no longer available for checkout');
      }

      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          orderType: data.orderType,
          subtotal,
          discount: discount + rewardDiscount,
          tax,
          deliveryFee,
          grandTotal,
          rewardCodeUsed,
          rewardPointsUsed: pointsRedeemed,
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

      // Mark milestone reward claim as redeemed if applicable
      if (validClaimToRedeem) {
        const claimUpdate = await tx.rewardClaim.updateMany({
          where: {
            id: validClaimToRedeem.id,
            userId,
            status: 'CLAIMED',
          },
          data: {
            status: 'REDEEMED',
            redeemedAt: new Date(),
            orderId: newOrder.id,
          },
        });

        if (claimUpdate.count !== 1) {
          throw new ApiError(400, 'Reward claim is no longer available for redemption');
        }
      }

      // Redeem reward points if applicable (deduct before earning)
      if (pointsRedeemed > 0) {
        await this.createRewardTransactionForUser(
          userId,
          RewardTransactionType.REDEEM,
          -pointsRedeemed,
          `Reward points redeemed on order ${orderNumber}`,
          newOrder.id,
          `order_${newOrder.id}`,
        );
      }

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
      const rewardCode = await this.generateRewardCode(tx, userId);
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
   * Optimized to avoid N+1 queries
   */
  private async validateCartItems(items: { menuItemId: string; quantity: number; addOns?: { addOnId: string }[] }[]) {
    // Collect all unique menu item IDs and add-on IDs
    const menuItemIds = [...new Set(items.map((item) => item.menuItemId))];
    const addOnIds = [...new Set(items.flatMap((item) => item.addOns?.map((a) => a.addOnId) || []))];

    // Fetch all menu items and add-ons in parallel
    const [menuItems, addOns] = await Promise.all([
      prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
      }),
      addOnIds.length > 0 ? prisma.addOn.findMany({
        where: { id: { in: addOnIds } },
      }) : [],
    ]);

    // Create maps for O(1) lookup
    const menuItemMap = new Map(menuItems.map(item => [item.id, item]));
    const addOnMap = new Map(addOns.map(addOn => [addOn.id, addOn]));

    for (const item of items) {
      // Validate quantity
      if (item.quantity <= 0) {
        throw new ApiError(400, 'Item quantity must be greater than zero');
      }

      // Check if menu item exists and is available
      const menuItem = menuItemMap.get(item.menuItemId);

      if (!menuItem) {
        throw new ApiError(400, `Menu item no longer exists`);
      }

      if (!menuItem.isAvailable) {
        throw new ApiError(400, `Menu item ${menuItem.name} is currently unavailable`);
      }

      // Validate add-ons
      if (item.addOns && item.addOns.length > 0) {
        const itemAddOnIds = item.addOns.map((a: { addOnId: string }) => a.addOnId);

        // Check if all add-ons exist and belong to this menu item
        for (const addOnId of itemAddOnIds) {
          const addOn = addOnMap.get(addOnId);
          if (!addOn) {
            throw new ApiError(400, 'One or more add-ons are invalid or no longer available');
          }
          if (addOn.menuItemId !== item.menuItemId) {
            throw new ApiError(400, `Add-on ${addOn.name} is not available for this menu item`);
          }
        }

        // Check for duplicate add-ons
        const uniqueAddOnIds = new Set(itemAddOnIds);
        if (uniqueAddOnIds.size !== itemAddOnIds.length) {
          throw new ApiError(400, 'Duplicate add-ons detected');
        }
      }
    }
  }

  /**
   * Calculate cart total from items (backend recalculation)
   * Optimized to avoid N+1 queries
   */
  private async calculateCartTotalFromItems(items: { menuItemId: string; quantity: number; addOns?: { addOnId: string }[] }[]) {
    let subtotal = 0;

    // Collect all unique menu item IDs and add-on IDs
    const menuItemIds = [...new Set(items.map((item) => item.menuItemId))];
    const addOnIds = [...new Set(items.flatMap((item) => item.addOns?.map((a) => a.addOnId) || []))];

    // Fetch all menu items and add-ons in a single query each
    const [menuItems, addOns] = await Promise.all([
      prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
      }),
      addOnIds.length > 0 ? prisma.addOn.findMany({
        where: { id: { in: addOnIds } },
      }) : [],
    ]);

    // Create maps for O(1) lookup
    const menuItemMap = new Map(menuItems.map(item => [item.id, item]));
    const addOnMap = new Map(addOns.map(addOn => [addOn.id, addOn]));

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);

      if (!menuItem) {
        throw new ApiError(400, `Menu item no longer exists`);
      }

      const unitPrice = Number(menuItem.price);

      let addOnsPrice = 0;
      if (item.addOns && item.addOns.length > 0) {
        for (const addOn of item.addOns) {
          const addOnData = addOnMap.get(addOn.addOnId);
          if (addOnData) {
            addOnsPrice += Number(addOnData.price);
          }
        }
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
   * Uses transaction to ensure atomic status update
   */
  async updateOrderStatus(orderId: string, data: UpdateOrderStatusInput, userRole: string) {
    if (userRole === 'CUSTOMER') {
      throw new ApiError(403, 'Access denied');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
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

      return tx.order.update({
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
    });
  }

  /**
   * Update payment status
   * Uses transaction to ensure atomic payment status update
   */
  async updatePaymentStatus(orderId: string, data: UpdatePaymentStatusInput, userRole: string) {
    if (userRole === 'CUSTOMER') {
      throw new ApiError(403, 'Access denied');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new ApiError(404, 'Order not found');
      }

      return tx.order.update({
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
  async createRewardTransaction(
    tx: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    userId: string,
    orderId: string | null,
    type: string,
    points: number,
    reason: string,
  ) {
    // Lock user row first for concurrency safety
    await tx.$queryRaw`
      SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
    `;

    // Get current balance
    const lastTransaction = await tx.rewardTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const runningBalance = (lastTransaction?.runningBalance || 0) + points;

    // Increment lifetimePointsEarned for EARN transactions
    if (type === 'EARN' && points > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          lifetimePointsEarned: {
            increment: points,
          },
        },
      });
    }

    return tx.rewardTransaction.create({
      data: {
        userId,
        orderId,
        type: type as any,
        points,
        runningBalance,
        reason,
      },
    });
  }

  /**
   * Generate reward code
   */
  private async generateRewardCode(tx: any, userId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const code = this.generateRewardCodeString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days

    return tx.rewardCode.create({
      data: {
        userId,
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

  /**
   * Calculate tier from points
   * Uses the same tier thresholds as the frontend configuration
   */
  private calculateTier(points: number): string {
    if (points >= 5000) return 'Elite';
    if (points >= 3000) return 'Diamond';
    if (points >= 1500) return 'Gold';
    if (points >= 500) return 'Silver';
    return 'Bronze';
  }

  /**
   * Get user's claimed rewards (redeemed reward codes)
   */
  private async getClaimedRewards(userId: string) {
    const claimedCodes = await prisma.rewardCode.findMany({
      where: {
        userId,
        status: 'REDEEMED',
      },
      orderBy: { redeemedAt: 'desc' },
      select: {
        code: true,
        reward: true,
        redeemedAt: true,
        orderId: true,
      },
    });

    // Fetch order numbers for codes that have orderId
    const orderIds = claimedCodes.filter(c => c.orderId).map(c => c.orderId);
    const orders = orderIds.length > 0 ? await prisma.order.findMany({
      where: { id: { in: orderIds as string[] } },
      select: { id: true, orderNumber: true },
    }) : [];

    const orderMap = new Map(orders.map(o => [o.id, o.orderNumber]));

    return claimedCodes.map((code) => ({
      code: code.code,
      reward: code.reward,
      redeemedAt: code.redeemedAt,
      orderNumber: code.orderId ? orderMap.get(code.orderId) || null : null,
    }));
  }

  /**
   * Claim a milestone reward for user
   */
  async claimReward(userId: string, rewardId: string) {
    const milestoneConfig = MILESTONE_CONFIG[rewardId];
    if (!milestoneConfig) {
      throw new ApiError(400, 'Invalid or unknown reward milestone ID');
    }

    // Check user's current points balance
    const currentBalance = await this.getUserRewardBalance(userId);
    if (currentBalance < milestoneConfig.points) {
      throw new ApiError(400, `Insufficient points balance. ${milestoneConfig.points} points required to claim ${milestoneConfig.name}.`);
    }

    // Check if user already claimed this milestone reward
    const existingClaim = await prisma.rewardClaim.findUnique({
      where: {
        userId_rewardId: {
          userId,
          rewardId,
        },
      },
    });

    if (existingClaim) {
      return existingClaim;
    }

    // Create persistent claim in PostgreSQL (idempotent / concurrency safe via unique constraint)
    try {
      const claim = await prisma.rewardClaim.create({
        data: {
          userId,
          rewardId,
          status: 'CLAIMED',
        },
      });

      return claim;
    } catch (error: any) {
      // Handle unique constraint race condition
      if (error?.code === 'P2002') {
        const claim = await prisma.rewardClaim.findUnique({
          where: {
            userId_rewardId: {
              userId,
              rewardId,
            },
          },
        });
        if (claim) return claim;
      }
      throw error;
    }
  }

  /**
   * Get user's full reward state
   * Returns points, tier, lifetimePointsEarned, claimed rewards, milestone claims, and recent history
   */
  async getUserFullRewards(userId: string) {
    const [balance, claimedRewards, milestoneClaims, recentHistory, user] = await Promise.all([
      this.getUserRewardBalance(userId),
      this.getClaimedRewards(userId),
      prisma.rewardClaim.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rewardTransaction.findMany({
        where: { userId },
        include: {
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { lifetimePointsEarned: true },
      }),
    ]);

    const tier = this.calculateTier(balance);

    return {
      points: balance,
      tier,
      lifetimePointsEarned: user?.lifetimePointsEarned || 0,
      claimedRewards,
      claims: milestoneClaims,
      history: recentHistory,
    };
  }

  /**
   * Create reward transaction for authenticated user
   * Uses transaction to ensure atomicity and prevent race conditions
   * Includes duplicate protection via orderId and referenceId
   * Uses raw SQL with FOR UPDATE to lock rows for concurrency safety
   */
  async createRewardTransactionForUser(
    userId: string,
    type: string,
    points: number,
    reason: string,
    orderId?: string | null,
    referenceId?: string | null,
  ) {
    return prisma.$transaction(async (tx) => {
      // Check for duplicate transaction via orderId or referenceId ONLY if provided
      if (referenceId || orderId) {
        const orConditions: any[] = [];
        if (referenceId) {
          orConditions.push({ referenceId });
        }
        if (orderId) {
          orConditions.push({ orderId });
        }

        const existingTransaction = await tx.rewardTransaction.findFirst({
          where: {
            userId,
            OR: orConditions,
          },
        });

        if (existingTransaction) {
          return {
            transaction: existingTransaction,
            newBalance: existingTransaction.runningBalance,
            previousBalance: existingTransaction.runningBalance - existingTransaction.points,
            isDuplicate: true,
          };
        }
      }

      // Lock user row first for per-user serial execution and concurrency safety
      await tx.$queryRaw`
        SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
      `;

      // Get current balance from last transaction
      const lastTransaction = await tx.rewardTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTransaction?.runningBalance || 0;
      const newBalance = currentBalance + points;

      // Prevent negative balance for REDEEM transactions
      if (type === 'REDEEM' && newBalance < 0) {
        throw new ApiError(400, 'Insufficient points balance');
      }

      // Increment lifetimePointsEarned for EARN transactions
      if (type === 'EARN' && points > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            lifetimePointsEarned: {
              increment: points,
            },
          },
        });
      }

      // Create transaction with referenceId & orderId
      const transaction = await tx.rewardTransaction.create({
        data: {
          userId,
          orderId: orderId || null,
          referenceId: referenceId || null,
          type: type as any,
          points,
          runningBalance: newBalance,
          reason,
        },
      });

      return {
        transaction,
        newBalance,
        previousBalance: currentBalance,
        isDuplicate: false,
      };
    });
  }
}

export const orderService = new OrderService();
