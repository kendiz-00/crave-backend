import { Prisma, PromoCodeStatus, PromoCodeDiscountType } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CreatePromoCodeInput, UpdatePromoCodeInput, ValidatePromoCodeInput } from '../validators/promo-code.validator';
import prisma from '@/database';

export class PromoCodeService {
  /**
   * Create a new promo code (admin only)
   */
  async createPromoCode(adminUserId: string, data: CreatePromoCodeInput) {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || !['ADMIN', 'OWNER'].includes(admin.role)) {
      throw new ApiError(403, 'Only admins can create promo codes');
    }

    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ApiError(400, 'Promo code already exists');
    }

    // Create promo code
    const promoCode = await prisma.promoCode.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        discountType: data.discountType as PromoCodeDiscountType,
        discountValue: data.discountValue,
        minSpend: data.minSpend,
        maxDiscountAmount: data.maxDiscountAmount,
        usageLimit: data.usageLimit,
        expiresAt: new Date(data.expiresAt),
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        restrictedUserIds: data.restrictedUserIds,
        restrictedEmails: data.restrictedEmails,
        createdBy: adminUserId,
        status: PromoCodeStatus.ACTIVE,
      },
    });

    return promoCode;
  }

  /**
   * Update a promo code (admin only)
   */
  async updatePromoCode(adminUserId: string, codeId: string, data: UpdatePromoCodeInput) {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || !['ADMIN', 'OWNER'].includes(admin.role)) {
      throw new ApiError(403, 'Only admins can update promo codes');
    }

    // Check if promo code exists
    const existing = await prisma.promoCode.findUnique({
      where: { id: codeId },
    });

    if (!existing) {
      throw new ApiError(404, 'Promo code not found');
    }

    // Update promo code
    const promoCode = await prisma.promoCode.update({
      where: { id: codeId },
      data: {
        ...(data.code && { code: data.code }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.discountType && { discountType: data.discountType as PromoCodeDiscountType }),
        ...(data.discountValue && { discountValue: data.discountValue }),
        ...(data.minSpend !== undefined && { minSpend: data.minSpend }),
        ...(data.maxDiscountAmount !== undefined && { maxDiscountAmount: data.maxDiscountAmount }),
        ...(data.usageLimit && { usageLimit: data.usageLimit }),
        ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
        ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
        ...(data.restrictedUserIds && { restrictedUserIds: data.restrictedUserIds }),
        ...(data.restrictedEmails && { restrictedEmails: data.restrictedEmails }),
        ...(data.status && { status: data.status as PromoCodeStatus }),
      },
    });

    return promoCode;
  }

  /**
   * Delete a promo code (admin only)
   */
  async deletePromoCode(adminUserId: string, codeId: string) {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || !['ADMIN', 'OWNER'].includes(admin.role)) {
      throw new ApiError(403, 'Only admins can delete promo codes');
    }

    // Delete promo code
    await prisma.promoCode.delete({
      where: { id: codeId },
    });

    return { message: 'Promo code deleted successfully' };
  }

  /**
   * Get all promo codes (admin only)
   */
  async getAllPromoCodes(adminUserId: string) {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || !['ADMIN', 'OWNER'].includes(admin.role)) {
      throw new ApiError(403, 'Only admins can view all promo codes');
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return promoCodes;
  }

  /**
   * Get a single promo code by ID (admin only)
   */
  async getPromoCodeById(adminUserId: string, codeId: string) {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || !['ADMIN', 'OWNER'].includes(admin.role)) {
      throw new ApiError(403, 'Only admins can view promo codes');
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { id: codeId },
    });

    if (!promoCode) {
      throw new ApiError(404, 'Promo code not found');
    }

    return promoCode;
  }

  /**
   * Validate a promo code for checkout
   */
  async validatePromoCode(data: ValidatePromoCodeInput, userId?: string, userEmail?: string) {
    const { code, cartItems } = data;

    // Find promo code
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      throw new ApiError(400, 'Invalid promo code');
    }

    // Check if promo code is active
    if (promoCode.status !== PromoCodeStatus.ACTIVE) {
      throw new ApiError(400, 'Promo code is not active');
    }

    // Check if promo code is within valid date range
    const now = new Date();
    if (now < promoCode.validFrom) {
      throw new ApiError(400, 'Promo code is not yet valid');
    }

    if (now > promoCode.expiresAt) {
      throw new ApiError(400, 'Promo code has expired');
    }

    // Check usage limit
    if (promoCode.usageCount >= promoCode.usageLimit) {
      throw new ApiError(400, 'Promo code has reached its usage limit');
    }

    // Calculate subtotal from cart items (server-side, not client-supplied)
    let subtotal = 0;
    if (cartItems && cartItems.length > 0) {
      const menuItemIds = cartItems.map(item => item.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
      });

      for (const cartItem of cartItems) {
        const menuItem = menuItems.find(mi => mi.id === cartItem.menuItemId);
        if (!menuItem) {
          throw new ApiError(400, 'Menu item no longer available');
        }
        const itemTotal = Number(menuItem.price) * cartItem.quantity;
        subtotal += itemTotal;

        // Add add-on prices
        if (cartItem.addOns && cartItem.addOns.length > 0) {
          for (const addOn of cartItem.addOns) {
            subtotal += addOn.price * cartItem.quantity;
          }
        }
      }
    }

    // Check minimum spend requirement
    if (promoCode.minSpend && subtotal < Number(promoCode.minSpend)) {
      throw new ApiError(400, `Minimum spend of GH₵${promoCode.minSpend} required`);
    }

    // Check user restrictions if user is logged in (from verified auth token)
    if (userId && promoCode.restrictedUserIds.length > 0) {
      if (!promoCode.restrictedUserIds.includes(userId)) {
        throw new ApiError(403, 'This promo code is not available for your account');
      }
    }

    // Check email restrictions if email is provided (from verified auth token)
    if (userEmail && promoCode.restrictedEmails.length > 0) {
      if (!promoCode.restrictedEmails.includes(userEmail.toLowerCase())) {
        throw new ApiError(403, 'This promo code is not available for your email');
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discountType === PromoCodeDiscountType.PERCENTAGE) {
      discountAmount = subtotal * (Number(promoCode.discountValue) / 100);
    } else {
      discountAmount = Number(promoCode.discountValue);
    }

    // Apply max discount cap if set
    if (promoCode.maxDiscountAmount && discountAmount > Number(promoCode.maxDiscountAmount)) {
      discountAmount = Number(promoCode.maxDiscountAmount);
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    return {
      valid: true,
      code: promoCode.code,
      name: promoCode.name,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      discountAmount,
      expiresAt: promoCode.expiresAt,
    };
  }

  /**
   * Mark expired promo codes as EXPIRED status
   */
  async markExpiredCodes() {
    const now = new Date();
    await prisma.promoCode.updateMany({
      where: {
        status: PromoCodeStatus.ACTIVE,
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: PromoCodeStatus.EXPIRED,
      },
    });
  }

  /**
   * Restore usage count when an order is cancelled
   * This allows the promo code to be used again
   */
  async restoreUsageCount(code: string) {
    await prisma.promoCode.update({
      where: { code: code.toUpperCase() },
      data: {
        usageCount: {
          decrement: 1,
        },
      },
    });
  }
}

export const promoCodeService = new PromoCodeService();
