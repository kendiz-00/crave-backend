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
import { authenticate, requireAdmin, cacheMiddleware, clearCache } from '@/middleware';

const router = Router();

// Public GET endpoints (cached)
// More specific routes must come before parameterized routes
router.get('/', cacheMiddleware(5 * 60 * 1000), getMenuItemsController);
router.get('/featured', cacheMiddleware(5 * 60 * 1000), getFeaturedMenuItemsController);
router.get('/search', cacheMiddleware(2 * 60 * 1000), searchMenuItemsController);
router.get('/category/:slug', cacheMiddleware(5 * 60 * 1000), getMenuItemsByCategoryController);
router.get('/slug/:slug', cacheMiddleware(10 * 60 * 1000), getMenuItemBySlugController);
router.get('/:id', cacheMiddleware(10 * 60 * 1000), getMenuItemController);

// Admin/Owner only endpoints (clears cache)
router.post('/', authenticate, requireAdmin, clearCache, createMenuItemController);
router.put('/:id', authenticate, requireAdmin, clearCache, updateMenuItemController);
router.delete('/:id', authenticate, requireAdmin, clearCache, deleteMenuItemController);

export default router;
