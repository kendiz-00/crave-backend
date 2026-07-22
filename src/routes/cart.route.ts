import { Router } from 'express';
import { cartController } from '../controllers';
import { authenticate } from '../middleware/auth.middleware';
import { validateCartOwnership } from '../middleware/ownership.middleware';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/cart
 * @desc    Create or update cart with items
 * @access  Private
 */
router.post('/', cartController.createCart);

/**
 * @route   GET /api/cart
 * @desc    Get user's active cart
 * @access  Private
 */
router.get('/', cartController.getCart);

/**
 * @route   PATCH /api/cart/items/:id
 * @desc    Update cart item quantity and add-ons
 * @access  Private
 */
router.patch('/items/:id', validateCartOwnership, cartController.updateCartItem);

/**
 * @route   DELETE /api/cart/items/:id
 * @desc    Delete cart item
 * @access  Private
 */
router.delete('/items/:id', validateCartOwnership, cartController.deleteCartItem);

/**
 * @route   DELETE /api/cart
 * @desc    Clear cart
 * @access  Private
 */
router.delete('/', cartController.clearCart);

export default router;
