import { z } from 'zod';

// Order item add-on validator
export const orderItemAddOnSchema = z.object({
  name: z.string().min(1, 'Add-on name is required'),
  price: z.number().nonnegative('Add-on price must be non-negative'),
});

// Order item validator
export const orderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  addOns: z.array(orderItemAddOnSchema).optional().default([]),
});

// Create order validator
export const createOrderSchema = z.object({
  orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']).default('DELIVERY'),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters'),
  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  customerEmail: z.string().email('Invalid email address').optional(),
  deliveryAddress: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
  rewardCodeUsed: z.string().optional(),
});

// Update order status validator
export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'REFUNDED']),
});

// Update payment status validator
export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CASH_ON_DELIVERY']),
});

// Types
export type OrderItemAddOnInput = z.infer<typeof orderItemAddOnSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
