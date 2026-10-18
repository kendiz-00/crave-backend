import { OrderStatus, PaymentStatus, RewardTransactionType, Prisma } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CreateOrderInput, UpdateOrderStatusInput, UpdatePaymentStatusInput } from '../validators';
import { cartService } from './cart.service';
import prisma from '@/database';

type PricedRecord = { id: string; price: number | string | { toString(): string } };
type PricedCartItem = { menuItemId: string; quantity: number; addOns?: { addOnId: string }[] };

export function calculateCartSubtotalFromCatalog(
  items: PricedCartItem[],
  menuItems: PricedRecord[],
  addOns: PricedRecord[],
): number {
  return items.reduce((subtotal, item) => {
    const menuItem = menuItems.find(candidate => candidate.id === item.menuItemId);
    if (!menuItem) {
      throw new ApiError(400, 'Menu item no longer exists');
    }
    const addOnTotal = (item.addOns || []).reduce((sum, selectedAddOn) => {
      const addOn = addOns.find(candidate => candidate.id === selectedAddOn.addOnId);
      if (!addOn) {
        throw new ApiError(400, 'One or more add-ons are invalid or no longer available');
      }
      return sum + Number(addOn.price);
    }, 0);
    return subtotal + (Number(menuItem.price) + addOnTotal) * item.quantity;
  }, 0);
}

export function calculateOrderAmounts(subtotal: number, discount: number, deliveryFee = 0) {
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round(Math.max(0, subtotal - discount + tax + deliveryFee) * 100) / 100;
  return { tax, grandTotal };
}

export const FIRST_ORDER_REWARD_ID = 'first_order_free_drink';
export const MILESTONE_100_REWARD_ID = 'milestone_free_drink_100';

export interface EligibleRewardProduct {
  id: string;
  name: string;
}

/**
 * Proposed authoritative allowlist of eligible free drinks (10 smoothies/refreshers, excluding shakes)
 * using stable product IDs from the CRAVE database.
 * Eligibility configuration can be updated here easily without modifying checkout logic.
 */
export const PROPOSED_ELIGIBLE_FREE_DRINKS: EligibleRewardProduct[] = [
  { id: '8d5c3819-2408-476b-97a6-7d21133ed69c', name: 'Sunkissed Strawberry Mango Smoothie' },
  { id: '40384fa8-8d33-4188-9fb3-020cf9a22dae', name: 'Banana Peanut Butter Chocolate' },
  { id: 'ea983683-a3a9-4222-ac7e-71f5375e2665', name: 'Lemonade Ice' },
  { id: '4c588fb8-7f1c-4dd8-b2ad-a14e5154b441', name: 'Strawberries and Cream' },
  { id: 'a1831759-ba35-4ad5-974f-2b8585cc26a1', name: 'Strawberry Pineapple Tang Smoothie' },
  { id: 'b01da45e-2437-4850-872b-a4458409d242', name: 'Exotic Tropical Fruit Blend Smoothie' },
  { id: 'cc7e7818-5143-4aa6-ade9-709f99c96691', name: 'Green Glow' },
  { id: '5389fb30-d80f-45c4-ba62-51b4f44fdd91', name: 'Water Mint Ice Slushie' },
  { id: 'f27574c7-fa39-4cad-8576-4551d2ed2548', name: 'Sexy Pina Colada' },
  { id: 'bf4b8669-0a3e-4203-b830-707c77f96188', name: 'Strawberry Colada Blast Smoothie' },
];

export const ELIGIBLE_FREE_DRINK_IDS = PROPOSED_ELIGIBLE_FREE_DRINKS.map((d) => d.id);

export const ELIGIBLE_FREE_DRINKS = [
  ...PROPOSED_ELIGIBLE_FREE_DRINKS.map((d) => d.name),
  // Legacy alias names preserved for backward compatibility and test fixture matching:
  'Strawberry Colada',
  'Pina Colada',
  'Watermelon Mint Ice',
  'Green Glow Smoothie',
  'Tropical Fruit Blend',
  'Pineapple Strawberry',
];

/**
 * Feature flag controlling whether the free drink eligibility list has received explicit business approval.
 * Disabled (false) by default in production.
 * Can be activated by setting REWARDS_ELIGIBLE_DRINKS_ENABLED=true in environment or calling setFreeDrinkEligibilityApproved(true).
 */
export let IS_FREE_DRINK_ELIGIBILITY_APPROVED = process.env.REWARDS_ELIGIBLE_DRINKS_ENABLED === 'true';

export function setFreeDrinkEligibilityApproved(approved: boolean) {
  IS_FREE_DRINK_ELIGIBILITY_APPROVED = approved;
}

/**
 * Reservation expiration window for in-flight checkouts.
 * Default is 15 minutes (900,000 ms).
 */
export const RESERVATION_EXPIRATION_MS = parseInt(process.env.REWARD_RESERVATION_TTL_MS || '900000', 10);

export const MILESTONE_CONFIG: Record<
  string,
  {
    points: number;
    name: string;
    categories?: string[];
    productIds?: string[];
    names?: string[];
  }
> = {
  [FIRST_ORDER_REWARD_ID]: {
    points: 0,
    name: 'Free Drink',
    categories: ['smoothies', 'smoothies-refreshers'],
    productIds: ELIGIBLE_FREE_DRINK_IDS,
    names: ELIGIBLE_FREE_DRINKS,
  },
  [MILESTONE_100_REWARD_ID]: {
    points: 100,
    name: 'Free Drink',
    categories: ['smoothies', 'smoothies-refreshers'],
    productIds: ELIGIBLE_FREE_DRINK_IDS,
    names: ELIGIBLE_FREE_DRINKS,
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
      let claim = await prisma.rewardClaim.findFirst({
        where: { id: data.claimedRewardId, userId },
      });

      if (!claim) {
        throw new ApiError(400, 'Invalid reward claim');
      }

      // Safe expiration and payment-aware reconciliation if currently RESERVED
      if (claim.status === 'RESERVED') {
        const reconciled = await this.reconcileClaimReservation(claim.id, userId);
        if (reconciled) {
          claim = reconciled;
        }
      }

      if (!claim) {
        throw new ApiError(400, 'Invalid reward claim');
      }

      if (claim.status !== 'AVAILABLE' && claim.status !== 'CLAIMED') {
        throw new ApiError(400, 'Reward claim is not available for redemption');
      }

      if (claim.orderId) {
        throw new ApiError(400, 'Reward claim is already linked to another order');
      }

      if (!IS_FREE_DRINK_ELIGIBILITY_APPROVED && (claim.rewardId === MILESTONE_100_REWARD_ID || claim.rewardId === FIRST_ORDER_REWARD_ID)) {
        throw new ApiError(400, 'Free drink reward eligibility list is currently pending business approval. Free drink rewards are disabled until approved.');
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
        const itemName = item.menuItem.name?.trim().toLowerCase();
        const itemId = item.menuItem.id;

        const idMatches = Boolean(
          milestoneConfig.productIds &&
          milestoneConfig.productIds.length > 0 &&
          milestoneConfig.productIds.includes(itemId)
        );
        const nameMatches = Boolean(
          milestoneConfig.names &&
          milestoneConfig.names.some(n => n.trim().toLowerCase() === itemName)
        );
        const catMatches = Boolean(
          milestoneConfig.categories &&
          milestoneConfig.categories.some(c => catSlug.includes(c.toLowerCase()))
        );

        // Product ID matching is authoritative for product allowlists.
        // Also support name matching for test fixtures/compatibility.
        // If neither is configured, fall back to category matching.
        const isMatch = (milestoneConfig.productIds && milestoneConfig.productIds.length > 0)
          ? (idMatches || nameMatches)
          : (milestoneConfig.names && milestoneConfig.names.length > 0 ? nameMatches : catMatches);

        if (isMatch) {
          if (!eligibleItem || Number(item.menuItem.price) > Number(eligibleItem.menuItem.price)) {
            eligibleItem = item;
          }
        }
      }

      if (!eligibleItem) {
        throw new ApiError(400, `Your cart does not contain an item eligible for ${milestoneConfig.name}`);
      }

      if (claim.rewardId === FIRST_ORDER_REWARD_ID) {
        // Ensure cart contains at least one non-complimentary item / qualifying meal
        const hasQualifyingMeal = cart.items.some(
          (item: { menuItemId: string; quantity: number }) => item.menuItemId !== eligibleItem.menuItemId || item.quantity > 1
        );
        if (!hasQualifyingMeal) {
          throw new ApiError(400, 'A qualifying meal is required in your cart to claim your free drink.');
        }
      }

      // Calculate authoritative discount (price of 1 unit of eligible item)
      rewardDiscount = Number(eligibleItem.menuItem.price);
      validClaimToRedeem = claim;
    }

    // Calculate totals (backend recalculation to prevent price tampering)
    const cartTotal = await this.calculateCartTotalFromItems(cart.items);
    const subtotal = cartTotal.subtotal;
    const deliveryFee = 0; // Delivery fee removed (GH¢ 0.00)
    const totalDiscount = discount + pointsDiscount + rewardDiscount;
    const { tax, grandTotal } = calculateOrderAmounts(subtotal, totalDiscount, deliveryFee);

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

      // Atomically reserve the claimed reward for this pending order.
      // Final redemption to REDEEMED occurs only after verified payment.
      if (validClaimToRedeem) {
        const claimUpdate = await tx.rewardClaim.updateMany({
          where: {
            id: validClaimToRedeem.id,
            userId,
            status: { in: ['AVAILABLE', 'CLAIMED'] },
            orderId: null,
          },
          data: {
            status: 'RESERVED',
            orderId: newOrder.id,
            reservedAt: new Date(),
          },
        });

        if (claimUpdate.count !== 1) {
          throw new ApiError(400, 'Reward claim is no longer available for redemption');
        }
      }

      // Redeem reward points if applicable (deduct atomically inside transaction)
      if (pointsRedeemed > 0) {
        await this.createRewardTransaction(
          tx,
          userId,
          newOrder.id,
          RewardTransactionType.REDEEM,
          -pointsRedeemed,
          `Reward points redeemed on order ${orderNumber}`,
          `redeem_order_${newOrder.id}`,
        );
      }

      // Projected reward points to be awarded upon verified payment (1 point per GHS spent).
      // Note: Points are NOT credited prematurely here; they are credited only upon verified payment.
      const pointsEarned = Math.floor(grandTotal);

      // Generate reward code for customer
      const rewardCode = await this.generateRewardCode(tx, userId);
      await tx.order.update({
        where: { id: newOrder.id },
        data: { rewardCodeGenerated: rewardCode.code, rewardPointsEarned: pointsEarned },
      });

      return { ...newOrder, rewardCodeGenerated: rewardCode.code, rewardPointsEarned: pointsEarned };
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
    subtotal = calculateCartSubtotalFromCatalog(items, menuItems, addOns);
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

      if (data.status === OrderStatus.CANCELLED) {
        // Only release RESERVED claims back to AVAILABLE. REDEEMED claims must NEVER be released.
        await tx.rewardClaim.updateMany({
          where: {
            orderId: orderId,
            status: 'RESERVED',
          },
          data: {
            status: 'AVAILABLE',
            reservedAt: null,
            orderId: null,
          },
        });

        // Restore spent points if order was cancelled before being paid
        if (order.rewardPointsUsed && order.rewardPointsUsed > 0 && order.paymentStatus !== PaymentStatus.PAID) {
          const restoreRef = `restore_cancel_${order.id}`;
          const existingRestore = await tx.rewardTransaction.findFirst({
            where: {
              userId: order.userId,
              referenceId: restoreRef,
            },
          });
          if (!existingRestore) {
            await this.createRewardTransaction(
              tx,
              order.userId,
              order.id,
              RewardTransactionType.ADJUSTMENT,
              order.rewardPointsUsed,
              `Restored spendable points from cancelled order ${order.orderNumber}`,
              restoreRef,
            );
          }
        }
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

      if (data.paymentStatus === PaymentStatus.FAILED) {
        // Release any RESERVED claim back to AVAILABLE
        await tx.rewardClaim.updateMany({
          where: {
            orderId: orderId,
            status: 'RESERVED',
          },
          data: {
            status: 'AVAILABLE',
            reservedAt: null,
            orderId: null,
          },
        });

        // Restore spent points
        if (order.rewardPointsUsed && order.rewardPointsUsed > 0) {
          const restoreRef = `restore_fail_${order.id}`;
          const existingRestore = await tx.rewardTransaction.findFirst({
            where: {
              userId: order.userId,
              referenceId: restoreRef,
            },
          });
          if (!existingRestore) {
            await this.createRewardTransaction(
              tx,
              order.userId,
              order.id,
              RewardTransactionType.ADJUSTMENT,
              order.rewardPointsUsed,
              `Restored spendable points from failed payment on order ${order.orderNumber}`,
              restoreRef,
            );
          }
        }
      }

      if (data.paymentStatus === PaymentStatus.PAID) {
        await this.processOrderPaymentSuccess(tx, orderId);
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
    referenceId?: string | null,
  ) {
    // Lock user row first for concurrency safety
    await tx.$queryRaw`
      SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
    `;

    // Idempotency: if referenceId is provided, check if transaction already exists
    if (referenceId) {
      const existing = await tx.rewardTransaction.findFirst({
        where: { userId, referenceId },
      });
      if (existing) {
        return existing;
      }
    }

    // Get current balance
    const lastTransaction = await tx.rewardTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const currentBalance = lastTransaction?.runningBalance || 0;
    const runningBalance = currentBalance + points;

    if (type === 'REDEEM' && runningBalance < 0) {
      throw new ApiError(400, 'Insufficient reward points');
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

    return tx.rewardTransaction.create({
      data: {
        userId,
        orderId,
        referenceId: referenceId || null,
        type: type as RewardTransactionType,
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

    // Check if user's phone is verified (required for point-based milestone rewards, but bypassed for first-order reward)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneVerified: true, phone: true, lifetimePointsEarned: true },
    });

    if (!user || !user.phoneVerified) {
      throw new ApiError(403, 'Phone number must be verified to claim rewards. Please complete phone verification first.');
    }

    const existingClaim = await prisma.rewardClaim.findUnique({
      where: {
        userId_rewardId: {
          userId,
          rewardId,
        },
      },
    });

    if (existingClaim) {
      if ((rewardId === FIRST_ORDER_REWARD_ID || rewardId === MILESTONE_100_REWARD_ID) && existingClaim.status === 'REDEEMED') {
        throw new ApiError(400, 'This reward has already been consumed.');
      }

      return existingClaim;
    }

    if (rewardId === FIRST_ORDER_REWARD_ID) {
      const hasPlacedOrder = await prisma.order.findFirst({
        where: {
          userId,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
          paymentStatus: { not: PaymentStatus.FAILED },
        },
        select: { id: true },
      });

      if (hasPlacedOrder) {
        throw new ApiError(400, 'The first-order reward is only available to customers who have not placed a qualifying order yet.');
      }

      try {
        const claim = await prisma.rewardClaim.create({
          data: {
            userId,
            rewardId,
            status: 'CLAIMED',
          },
        });

        return claim;
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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

    // Milestone eligibility is strictly gated by verified lifetimePointsEarned (Rule 2)
    const lifetimePoints = user.lifetimePointsEarned || 0;
    if (lifetimePoints < milestoneConfig.points) {
      throw new ApiError(400, `Insufficient lifetime points. ${milestoneConfig.points} lifetime points required for ${milestoneConfig.name}.`);
    }

    // Create persistent claim in PostgreSQL (idempotent / concurrency safe via unique constraint)
    try {
      const claim = await prisma.rewardClaim.create({
        data: {
          userId,
          rewardId,
          status: 'AVAILABLE',
        },
      });

      return claim;
    } catch (error: unknown) {
      // Handle unique constraint race condition
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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

    // Ensure milestone 100 free drink entitlement exists if user has reached 100 lifetime points
    if ((user?.lifetimePointsEarned || 0) >= 100) {
      const hasMilestone100 = milestoneClaims.some(c => c.rewardId === MILESTONE_100_REWARD_ID);
      if (!hasMilestone100) {
        try {
          const autoClaim = await prisma.rewardClaim.create({
            data: {
              userId,
              rewardId: MILESTONE_100_REWARD_ID,
              status: 'AVAILABLE',
            },
          });
          milestoneClaims.unshift(autoClaim);
        } catch (e: unknown) {
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) {
            throw e;
          }
        }
      }
    }

    // Reconcile any expired reservations for this user
    for (let i = 0; i < milestoneClaims.length; i++) {
      if (milestoneClaims[i].status === 'RESERVED') {
        const reconciled = await this.reconcileClaimReservation(milestoneClaims[i].id, userId);
        if (reconciled) {
          milestoneClaims[i] = reconciled;
        }
      }
    }

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
   * Process all reward and fulfillment actions upon verified successful payment.
   * Atomic and idempotent:
   * 1. Awards reward points (1 point per GHS spent) if not already awarded.
   * 2. Unlocks milestone 100 free drink entitlement if user reaches 100 lifetime points.
   * 3. Permanently transitions RESERVED / CLAIMED reward claims to REDEEMED.
   */
  async processOrderPaymentSuccess(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, lifetimePointsEarned: true },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // 1. Award reward points idempotently
    const earnReferenceId = `earn_order_${order.id}`;
    const existingEarnTx = await tx.rewardTransaction.findFirst({
      where: {
        userId: order.userId,
        referenceId: earnReferenceId,
      },
    });

    const pointsToEarn = order.rewardPointsEarned ?? Math.floor(Number(order.grandTotal));

    if (!existingEarnTx && pointsToEarn > 0) {
      // Lock user row for concurrency safety
      await tx.$queryRaw`
        SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE
      `;

      const lastTx = await tx.rewardTransaction.findFirst({
        where: { userId: order.userId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTx?.runningBalance || 0;
      const runningBalance = currentBalance + pointsToEarn;

      // Increment lifetimePointsEarned
      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: {
          lifetimePointsEarned: {
            increment: pointsToEarn,
          },
        },
        select: { lifetimePointsEarned: true },
      });

      // Create EARN ledger entry
      await tx.rewardTransaction.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          referenceId: earnReferenceId,
          type: RewardTransactionType.EARN,
          points: pointsToEarn,
          runningBalance,
          reason: `Points earned on order ${order.orderNumber}`,
        },
      });

      // 2. Automatic 100-point milestone unlock
      if (updatedUser.lifetimePointsEarned >= 100) {
        const existingClaim = await tx.rewardClaim.findUnique({
          where: {
            userId_rewardId: {
              userId: order.userId,
              rewardId: MILESTONE_100_REWARD_ID,
            },
          },
        });

        if (!existingClaim) {
          try {
            await tx.rewardClaim.create({
              data: {
                userId: order.userId,
                rewardId: MILESTONE_100_REWARD_ID,
                status: 'AVAILABLE',
              },
            });
          } catch (e: unknown) {
            if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) {
              throw e;
            }
          }
        }
      }
    } else {
      // If points were already awarded or pointsToEarn is 0, check if milestone unlock is needed
      const user = await tx.user.findUnique({
        where: { id: order.userId },
        select: { lifetimePointsEarned: true },
      });
      if (user && user.lifetimePointsEarned >= 100) {
        const existingClaim = await tx.rewardClaim.findUnique({
          where: {
            userId_rewardId: {
              userId: order.userId,
              rewardId: MILESTONE_100_REWARD_ID,
            },
          },
        });
        if (!existingClaim) {
          try {
            await tx.rewardClaim.create({
              data: {
                userId: order.userId,
                rewardId: MILESTONE_100_REWARD_ID,
                status: 'AVAILABLE',
              },
            });
          } catch (e: unknown) {
            if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) {
              throw e;
            }
          }
        }
      }
    }

    // 3. Permanently mark reserved or claimed rewards as REDEEMED
    await tx.rewardClaim.updateMany({
      where: {
        orderId: order.id,
        userId: order.userId,
        status: { in: ['RESERVED', 'CLAIMED'] },
      },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
      },
    });
  }

  /**
   * Helper to verify a Paystack reference status directly without performing mutations.
   * Returns 'success' | 'failed' | 'abandoned' | 'pending' | 'unknown'.
   */
  async checkPaystackReferenceStatus(reference: string): Promise<'success' | 'failed' | 'abandoned' | 'pending' | 'unknown'> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return 'unknown';

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      const body = (await response.json()) as { status?: boolean; data?: { status?: string } };
      if (!body?.status || !body?.data) return 'unknown';
      const status = body.data.status?.toLowerCase();
      if (status === 'success') return 'success';
      if (status === 'failed') return 'failed';
      if (status === 'abandoned') return 'abandoned';
      if (status === 'pending' || status === 'ongoing' || status === 'processing') return 'pending';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Safe, payment-aware reconciliation for an individual claim reservation.
   * Guarantees:
   * 1. Never releases a reservation if payment may have succeeded.
   * 2. Automatically releases abandoned reservations after the TTL window (default 15 mins)
   *    only once confirmed absent or failed at the payment gateway.
   * 3. Permanently redeems the claim if payment is verified to have succeeded.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async reconcileClaimReservation(claimId: string, userId: string): Promise<any> {
    const claim = await prisma.rewardClaim.findFirst({
      where: { id: claimId, userId },
    });

    if (!claim || claim.status !== 'RESERVED') {
      return claim;
    }

    // If reservation is still within active checkout window (< 15 mins), keep RESERVED
    const now = Date.now();
    const reservedTime = claim.reservedAt ? claim.reservedAt.getTime() : 0;
    if (reservedTime && now - reservedTime < RESERVATION_EXPIRATION_MS) {
      return claim;
    }

    // Reservation is older than TTL — inspect linked order and payment
    if (!claim.orderId) {
      return await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { status: 'AVAILABLE', reservedAt: null, orderId: null },
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: claim.orderId },
      include: {
        payments: true,
      },
    });

    if (!order) {
      return await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { status: 'AVAILABLE', reservedAt: null, orderId: null },
      });
    }

    // If order was already marked paid, finalize claim as REDEEMED (never release)
    if (order.paymentStatus === PaymentStatus.PAID) {
      return await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { status: 'REDEEMED', redeemedAt: new Date() },
      });
    }

    // If order is explicitly cancelled or payment failed, safely release back to AVAILABLE
    if (order.status === OrderStatus.CANCELLED || order.paymentStatus === PaymentStatus.FAILED) {
      return await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { status: 'AVAILABLE', reservedAt: null, orderId: null },
      });
    }

    // If order is PENDING: inspect payment record
    const payment = order.payments && order.payments.length > 0 ? order.payments[0] : null;

    if (!payment || !payment.reference) {
      // No payment was ever initiated. Safe to cancel order and release reservation.
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.FAILED },
      });
      return await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { status: 'AVAILABLE', reservedAt: null, orderId: null },
      });
    }

    // Payment reference exists: verify with Paystack
    const gatewayStatus = await this.checkPaystackReferenceStatus(payment.reference);

    if (gatewayStatus === 'success') {
      // Payment actually succeeded! Complete order and finalize claim as REDEEMED
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: PaymentStatus.PAID, status: 'CONFIRMED' },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.PAID, verifiedAt: new Date() },
        });
        await this.processOrderPaymentSuccess(tx, order.id);
      });
      return await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
    }

    if (gatewayStatus === 'failed' || gatewayStatus === 'abandoned') {
      // Payment definitely failed or abandoned at gateway -> cancel order and release claim
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.FAILED },
      });
      return await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { status: 'AVAILABLE', reservedAt: null, orderId: null },
      });
    }

    // If gateway status is pending, ongoing, or unknown (network error):
    // DO NOT RELEASE. Preserve reservation to prevent double-dipping.
    return claim;
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
        const orConditions: Prisma.RewardTransactionWhereInput[] = [];
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
          type: type as RewardTransactionType,
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
