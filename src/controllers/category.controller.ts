import { Request, Response } from 'express';
import { CategoryService } from '@/services';
import { categorySchema, updateCategorySchema } from '@/validators';
import { asyncHandler } from '@/middleware';
import { HttpStatus } from '@/types';

export const createCategoryController = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = categorySchema.parse(req.body);
  const category = await CategoryService.createCategory(validatedData);

  res.status(HttpStatus.CREATED).json({
    success: true,
    message: 'Category created successfully',
    data: category,
  });
});

export const getAllCategoriesController = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await CategoryService.getAllCategories();

  res.status(HttpStatus.OK).json({
    success: true,
    data: categories,
  });
});

export const getCategoryController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await CategoryService.getCategoryById(id);

  res.status(HttpStatus.OK).json({
    success: true,
    data: category,
  });
});

export const getCategoryBySlugController = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const category = await CategoryService.getCategoryBySlug(slug);

  res.status(HttpStatus.OK).json({
    success: true,
    data: category,
  });
});

export const updateCategoryController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateCategorySchema.parse(req.body);
  const category = await CategoryService.updateCategory(id, validatedData);

  res.status(HttpStatus.OK).json({
    success: true,
    message: 'Category updated successfully',
    data: category,
  });
});

export const deleteCategoryController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CategoryService.deleteCategory(id);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
  });
});
