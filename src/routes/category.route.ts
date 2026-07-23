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
// More specific routes must come before parameterized routes
router.get('/', getAllCategoriesController);
router.get('/slug/:slug', getCategoryBySlugController);
router.get('/:id', getCategoryController);

// Admin/Owner only endpoints
router.post('/', authenticate, requireAdmin, createCategoryController);
router.put('/:id', authenticate, requireAdmin, updateCategoryController);
router.delete('/:id', authenticate, requireAdmin, deleteCategoryController);

export default router;
