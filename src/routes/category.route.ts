import { Router } from 'express';
import {
  createCategoryController,
  getAllCategoriesController,
  getCategoryController,
  getCategoryBySlugController,
  updateCategoryController,
  deleteCategoryController,
} from '@/controllers';
import { authenticate, requireAdmin } from '@/middleware';

const router = Router();

// Public GET endpoints
router.get('/', getAllCategoriesController);
router.get('/:id', getCategoryController);
router.get('/slug/:slug', getCategoryBySlugController);

// Admin/Owner only endpoints
router.post('/', authenticate, requireAdmin, createCategoryController);
router.put('/:id', authenticate, requireAdmin, updateCategoryController);
router.delete('/:id', authenticate, requireAdmin, deleteCategoryController);

export default router;
