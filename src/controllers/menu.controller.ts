import { Request, Response } from 'express';
import { MenuService } from '@/services';
import { menuItemSchema, updateMenuItemSchema, menuQuerySchema } from '@/validators';
import { asyncHandler } from '@/middleware';
import { HttpStatus } from '@/types';

export const createMenuItemController = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = menuItemSchema.parse(req.body);
  const menuItem = await MenuService.createMenuItem(validatedData);

  res.status(HttpStatus.CREATED).json({
    success: true,
    message: 'Menu item created successfully',
    data: menuItem,
  });
});

export const getMenuItemController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const menuItem = await MenuService.getMenuItemById(id);

  res.status(HttpStatus.OK).json({
    success: true,
    data: menuItem,
  });
});

export const getMenuItemBySlugController = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const menuItem = await MenuService.getMenuItemBySlug(slug);

  res.status(HttpStatus.OK).json({
    success: true,
    data: menuItem,
  });
});

export const updateMenuItemController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateMenuItemSchema.parse(req.body);
  const menuItem = await MenuService.updateMenuItem(id, validatedData);

  res.status(HttpStatus.OK).json({
    success: true,
    message: 'Menu item updated successfully',
    data: menuItem,
  });
});

export const deleteMenuItemController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await MenuService.deleteMenuItem(id);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
  });
});

export const getMenuItemsController = asyncHandler(async (req: Request, res: Response) => {
  const validatedQuery = menuQuerySchema.parse(req.query);
  const result = await MenuService.getMenuItems(validatedQuery);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getFeaturedMenuItemsController = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const menuItems = await MenuService.getFeaturedMenuItems(limit);

  res.status(HttpStatus.OK).json({
    success: true,
    data: menuItems,
  });
});

export const getMenuItemsByCategoryController = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const result = await MenuService.getMenuItemsByCategorySlug(slug, page, limit);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result.data,
    category: result.category,
    pagination: result.pagination,
  });
});

export const searchMenuItemsController = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Search query is required',
    });
    return;
  }

  const validatedQuery = menuQuerySchema.parse({
    ...req.query,
    search: q,
  });
  const result = await MenuService.getMenuItems(validatedQuery);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});
