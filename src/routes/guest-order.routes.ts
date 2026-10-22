import { Router } from 'express';
import { guestOrderController } from '../controllers/guest-order.controller';

const router = Router();

/**
 * @route   POST /api/guest-orders
 * @desc    Create a guest order (no authentication required)
 * @access  Public
 */
router.post('/', guestOrderController.createGuestOrder.bind(guestOrderController));

/**
 * @route   GET /api/guest-orders/key/:idempotencyKey
 * @desc    Get order by idempotency key
 * @access  Public
 */
router.get('/key/:idempotencyKey', guestOrderController.getOrderByKey.bind(guestOrderController));

/**
 * @route   POST /api/guest-orders/:orderId/cancel
 * @desc    Cancel a guest order (release promo reservation)
 * @access  Public
 */
router.post('/:orderId/cancel', guestOrderController.cancelGuestOrder.bind(guestOrderController));

/**
 * @route   POST /api/guest-orders/:orderId/confirm
 * @desc    Confirm guest order (restaurant confirmation, consume usage)
 * @access  Public (should be protected by webhook signature in production)
 */
router.post('/:orderId/confirm', guestOrderController.confirmGuestOrder.bind(guestOrderController));

export default router;
