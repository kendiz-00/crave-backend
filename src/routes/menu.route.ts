import { Router } from 'express';
import {
  createMenuItemController,
  getMenuItemController,
  getMenuItemBySlugController,
  updateMenuItemController,
  deleteMenuItemController,
  getMenuItemsController,
  getFeaturedMenuItemsController,
  getMenuItemsByCategoryController,
  searchMenuItemsController,
} from '@/controllers';
import { authenticate, requireAdmin } from '@/middleware';

const router = Router();

// Public GET endpoints
router.get('/', getMenuItemsController);
router.get('/featured', getFeaturedMenuItemsController);
router.get('/search', searchMenuItemsController);
router.get('/category/:slug', getMenuItemsByCategoryController);
router.get('/:id', getMenuItemController);
router.get('/slug/:slug', getMenuItemBySlugController);

// Admin/Owner only endpoints
router.post('/', authenticate, requireAdmin, createMenuItemController);
router.put('/:id', authenticate, requireAdmin, updateMenuItemController);
router.delete('/:id', authenticate, requireAdmin, deleteMenuItemController);

export default router;
