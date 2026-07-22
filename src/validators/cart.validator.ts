import { z } from 'zod';

// Cart item add-on validator
export const cartItemAddOnSchema = z.object({
  addOnId: z.string().uuid('Invalid add-on ID'),
  name: z.string().min(1, 'Add-on name is required'),
  price: z.number().nonnegative('Add-on price must be non-negative'),
});

// Cart item validator
export const cartItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  addOns: z.array(cartItemAddOnSchema).optional().default([]),
});

// Create cart validator
export const createCartSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Cart must have at least one item'),
});

// Update cart item validator
export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
  addOns: z.array(cartItemAddOnSchema).optional(),
});

// Types
export type CartItemAddOnInput = z.infer<typeof cartItemAddOnSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CreateCartInput = z.infer<typeof createCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
