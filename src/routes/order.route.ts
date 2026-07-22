import { Router } from 'express';
import { orderController } from '../controllers';
import { authenticate } from '../middleware/auth.middleware';
import { validateOrderOwnership, validateOrderCancellation } from '../middleware/ownership.middleware';

const router = Router();

// All order routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/orders/checkout
 * @desc    Create order from cart
 * @access  Private
 */
router.post('/checkout', orderController.checkout);

/**
 * @route   POST /api/orders
 * @desc    Create order (alias for checkout)
 * @access  Private
 */
router.post('/', orderController.createOrder);

/**
 * @route   GET /api/orders
 * @desc    Get all orders (admin/staff only)
 * @access  Private (Admin/Staff)
 */
router.get('/', orderController.getAllOrders);

/**
 * @route   GET /api/orders/my-orders
 * @desc    Get current user's orders
 * @access  Private
 */
router.get('/my-orders', orderController.getMyOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get('/:id', validateOrderOwnership, orderController.getOrderById);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order status (admin/staff only)
 * @access  Private (Admin/Staff)
 */
router.patch('/:id/status', orderController.updateOrderStatus);

/**
 * @route   PATCH /api/orders/:id/payment
 * @desc    Update payment status (admin/staff only)
 * @access  Private (Admin/Staff)
 */
router.patch('/:id/payment', orderController.updatePaymentStatus);

/**
 * @route   DELETE /api/orders/:id
 * @desc    Cancel/delete order
 * @access  Private
 */
router.delete('/:id', validateOrderCancellation, orderController.deleteOrder);

export default router;
