import { Prisma, OrderStatus, PaymentStatus, PromoCodeStatus } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CreateGuestOrderInput } from '../validators/guest-order.validator';
import { promoCodeService } from './promo-code.service';
import prisma from '@/database';
import crypto from 'crypto';

export class GuestOrderService {
  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `CRV-${year}-${random}`;
  }

  /**
   * Create idempotency key from order data
   * Hash of customer, items, promo code to prevent duplicate submissions
   */
  private generateIdempotencyKey(data: CreateGuestOrderInput): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    
    const dataString = JSON.stringify({
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      items: data.items,
      promoCodeUsed: data.promoCodeUsed,
      orderType: data.orderType,
    });
    
    hash.update(dataString);
    return hash.digest('hex');
  }

  /**
   * Create a guest order (no authentication required)
   */
  async createGuestOrder(data: CreateGuestOrderInput, authenticatedUserId?: string, authenticatedUserEmail?: string) {
    // Use provided idempotencyKey or generate one
    const idempotencyKey = data.idempotencyKey || this.generateIdempotencyKey(data);

    // Check for existing order with same idempotencyKey
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
    });

    if (existingOrder) {
      // Verify it's the same customer and same payload
      const payloadMatch = 
        existingOrder.customerName === data.customerName &&
        existingOrder.customerPhone === data.customerPhone &&
        existingOrder.customerEmail === data.customerEmail &&
        existingOrder.promoCodeUsed === data.promoCodeUsed;

      if (payloadMatch) {
        // Same order, return it
        return {
          order: existingOrder,
          isDuplicate: true,
        };
      } else {
        // Different payload with same key - reject to prevent key collision
        throw new ApiError(409, 'Duplicate order detected. Please refresh and try again.');
      }
    }

    // Validate cart items against current menu
    const menuItemIds = data.items.map(item => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
        isDeleted: false,
      },
    });

    // Check all items exist and are available
    for (const item of data.items) {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
      if (!menuItem) {
        throw new ApiError(400, `Menu item not found or unavailable: ${item.menuItemId}`);
      }
    }

    // Calculate subtotal from server-fetched prices
    let subtotal = 0;
    const cartItemsWithPrices = data.items.map(item => {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
      const itemTotal = Number(menuItem.price) * item.quantity;
      
      // Add add-on prices
      let addOnTotal = 0;
      if (item.addOns && item.addOns.length > 0) {
        addOnTotal = item.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
      }
      
      subtotal += itemTotal + addOnTotal;
      
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: Number(menuItem.price),
        totalPrice: itemTotal + addOnTotal,
        addOns: item.addOns || [],
      };
    });

    // Validate promo code if provided
    let promoDiscount = 0;
    let promoCodeUsed = null;
    let promoReservation = null;

    if (data.promoCodeUsed) {
      // Validate promo code with optional authenticated identity
      const promoResult = await promoCodeService.validatePromoCode(
        {
          code: data.promoCodeUsed,
          cartItems: cartItemsWithPrices,
        },
        data.userId,
        data.userEmail
      );

      promoDiscount = promoResult.discountAmount;
      promoCodeUsed = promoResult.code;

      // Create expiring reservation for the last available use
      const promoCodeDetails = await prisma.promoCode.findUnique({
        where: { code: data.promoCodeUsed },
      });

      if (promoCodeDetails && promoCodeDetails.usageCount >= promoCodeDetails.usageLimit - 1) {
        // Last available use - create reservation
        const reservationId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        promoReservation = await prisma.orderReservation.create({
          data: {
            id: reservationId,
            promoCodeId: promoCodeDetails.id,
            promoCode: data.promoCodeUsed,
            expiresAt,
            customerId: data.userId || null,
            customerEmail: data.userEmail || null,
            status: 'RESERVED',
          },
        });
      }
    }

    // Calculate totals
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const deliveryFee = 0; // Delivery fee removed
    const grandTotal = Math.max(0, subtotal - promoDiscount + tax + deliveryFee);

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order (no cart since guest checkout)
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: data.userId || null, // Null for true guests
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.CASH_ON_DELIVERY, // WhatsApp orders
          orderType: data.orderType,
          subtotal,
          discount: promoDiscount,
          tax,
          deliveryFee,
          grandTotal,
          promoCodeUsed,
          rewardPointsUsed: 0,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          deliveryAddress: data.deliveryAddress,
          latitude: data.latitude,
          longitude: data.longitude,
          notes: data.notes,
          idempotencyKey,
          items: {
            create: cartItemsWithPrices.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              snapshotName: menuItems.find(mi => mi.id === item.menuItemId)?.name || 'Unknown',
              snapshotPrice: item.unitPrice,
              snapshotImage: menuItems.find(mi => mi.id === item.menuItemId)?.imageUrl || '',
              snapshotSku: menuItems.find(mi => mi.id === item.menuItemId)?.sku || null,
              subtotal: item.totalPrice,
              addOns: {
                create: item.addOns.map(addOn => ({
                  name: addOn.name,
                  snapshotPrice: addOn.price,
                })),
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

      // Link reservation to order if exists
      if (promoReservation) {
        await tx.orderReservation.update({
          where: { id: promoReservation.id },
          data: {
            orderId: newOrder.id,
            customerId: data.userId || null,
            customerEmail: data.userEmail || null,
          },
        });
      }

      return newOrder;
    });

    return {
      order,
      isDuplicate: false,
      promoReservation,
    };
  }

  /**
   * Get order by idempotency key
   */
  async getOrderByKey(idempotencyKey: string) {
    const order = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        items: {
          include: {
            addOns: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    return order;
  }

  /**
   * Cancel guest order (release promo reservation)
   */
  async cancelGuestOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ApiError(400, 'Can only cancel pending orders');
    }

    // Cancel order
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    // Release promo reservation and restore usage count
    if (order.promoCodeUsed) {
      await prisma.$transaction(async (tx) => {
        // Release reservation
        await tx.orderReservation.updateMany({
          where: {
            orderId,
            status: 'RESERVED',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        // Restore usage count
        await tx.promoCode.update({
          where: { code: order.promoCodeUsed },
          data: {
            usageCount: {
              decrement: 1,
            },
          },
        });
      });
    }

    return { message: 'Order cancelled' };
  }

  /**
   * Confirm guest order (consume promo usage, release reservation)
   * Called when restaurant confirms the order
   */
  async confirmGuestOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ApiError(400, 'Order is not pending');
    }

    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });

      // Consume promo reservation and increment usage
      if (order.promoCodeUsed) {
        // Mark reservation as consumed
        await tx.orderReservation.updateMany({
          where: {
            orderId,
            status: 'RESERVED',
          },
          data: {
            status: 'CONSUMED',
            consumed: true,
          },
        });

        // Increment usage count (atomic with check)
        const promoCode = await tx.promoCode.findUnique({
          where: { code: order.promoCodeUsed },
        });

        if (promoCode && promoCode.usageCount < promoCode.usageLimit) {
          await tx.promoCode.update({
            where: {
              code: order.promoCodeUsed,
              usageCount: {
                lt: promoCode.usageLimit,
              },
            },
            data: {
              usageCount: {
                increment: 1,
              },
            },
          });
        }
      }
    });

    return { message: 'Order confirmed' };
  }

  /**
   * Clean up expired reservations and release usage for abandoned orders
   */
  async cleanupExpiredReservations() {
    const now = new Date();

    // Find expired reservations
    const expiredReservations = await prisma.orderReservation.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
        status: 'RESERVED',
      },
    });

    // Release each expired reservation
    for (const reservation of expiredReservations) {
      await prisma.$transaction(async (tx) => {
        await tx.orderReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'EXPIRED',
          },
        });

        // Restore usage count
        await tx.promoCode.update({
          where: { code: reservation.promoCode },
          data: {
            usageCount: {
              decrement: 1,
            },
          },
        });
      });
    });

    return {
      released: expiredReservations.length,
    };
  }
}

export const guestOrderService = new GuestOrderService();
