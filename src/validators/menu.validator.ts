import { z } from 'zod';

// Category validators
export const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(50),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = categorySchema.partial();

// MenuItem validators
export const menuItemSchema = z.object({
  name: z.string().min(2, 'Menu item name must be at least 2 characters').max(100),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  price: z.number().positive('Price must be positive').max(9999.99, 'Price must be less than 10000'),
  imageUrl: z.string().url('Invalid image URL'),
  preparationTime: z.number().int().min(1, 'Preparation time must be at least 1 minute').max(180, 'Preparation time must be less than 3 hours'),
  calories: z.number().int().min(0).optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  addOns: z.array(z.object({
    name: z.string().min(2).max(50),
    price: z.number().positive().max(999.99),
    isRequired: z.boolean().optional(),
    maxSelections: z.number().int().min(1).max(10).optional(),
  })).optional(),
  images: z.array(z.object({
    imageUrl: z.string().url(),
    sortOrder: z.number().int().min(0).optional(),
  })).optional(),
});

export const updateMenuItemSchema = menuItemSchema.partial().extend({
  id: z.string().uuid().optional(),
});

// Query parameter validators
export const menuQuerySchema = z.object({
  category: z.string().optional(),
  featured: z.enum(['true', 'false']).optional(),
  available: z.enum(['true', 'false']).optional(),
  search: z.string().min(1).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'name-asc', 'name-desc']).default('newest'),
});

// Types
export type CategoryInput = z.infer<typeof categorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type MenuQueryInput = z.infer<typeof menuQuerySchema>;
