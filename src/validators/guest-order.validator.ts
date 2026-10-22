import { z } from 'zod';

export const GuestOrderItemAddOnSchema = z.object({
  addOnId: z.string().uuid(),
  name: z.string(),
  price: z.number(),
});

export const GuestOrderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  addOns: z.array(GuestOrderItemAddOnSchema).optional().default([]),
});

export const CreateGuestOrderSchema = z.object({
  orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']).default('DELIVERY'),
  items: z.array(GuestOrderItemSchema).min(1, 'Order must contain at least one item'),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters'),
  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  customerEmail: z.string().email('Invalid email address').optional(),
  deliveryAddress: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
  promoCodeUsed: z.string().optional(),
  userId: z.string().uuid().optional(), // Optional authenticated user ID
  userEmail: z.string().email().optional(), // Optional authenticated user email
  idempotencyKey: z.string().uuid().optional(),
});

export type CreateGuestOrderInput = z.infer<typeof CreateGuestOrderSchema>;
export type GuestOrderItemInput = z.infer<typeof GuestOrderItemSchema>;
export type GuestOrderItemAddOnInput = z.infer<typeof GuestOrderItemAddOnSchema>;
