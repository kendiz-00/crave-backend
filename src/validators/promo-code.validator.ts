import { z } from 'zod';

export const PromoCodeDiscountType = z.enum(['PERCENTAGE', 'FIXED']);

export const PromoCodeStatus = z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']);

export const CreatePromoCodeSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  discountType: PromoCodeDiscountType,
  discountValue: z.number().positive(),
  minSpend: z.number().min(0).optional(),
  maxDiscountAmount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().default(1),
  expiresAt: z.string().datetime(),
  validFrom: z.string().datetime().optional(),
  restrictedUserIds: z.array(z.string().uuid()).default([]),
  restrictedEmails: z.array(z.string().email()).default([]),
});

export const UpdatePromoCodeSchema = CreatePromoCodeSchema.partial().extend({
  status: PromoCodeStatus.optional(),
});

export const ValidatePromoCodeSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  cartItems: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    addOns: z.array(z.object({
      addOnId: z.string().uuid(),
      name: z.string(),
      price: z.number(),
    })).optional(),
  })).optional(),
});

export type CreatePromoCodeInput = z.infer<typeof CreatePromoCodeSchema>;
export type UpdatePromoCodeInput = z.infer<typeof UpdatePromoCodeSchema>;
export type ValidatePromoCodeInput = z.infer<typeof ValidatePromoCodeSchema>;
