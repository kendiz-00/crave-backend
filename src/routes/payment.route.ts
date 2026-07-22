import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { paymentService } from '../services/payment.service';
import { initializePaymentSchema, verifyPaymentSchema, refundPaymentSchema } from '../validators';

const router = Router();

/**
 * @route   POST /api/payments/initialize
 * @desc    Initialize payment with Paystack
 * @access  Private
 */
router.post(
  '/initialize',
  authenticate,
  asyncHandler(async (req, res) => {
    const validatedData = initializePaymentSchema.parse(req.body);

    const payment = await paymentService.initializePayment(
      validatedData.orderId,
      validatedData.email,
      validatedData.amount,
      validatedData.method
    );

    res.json({
      success: true,
      data: payment,
    });
  })
);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify payment with Paystack
 * @access  Private
 */
router.post(
  '/verify',
  authenticate,
  asyncHandler(async (req, res) => {
    const validatedData = verifyPaymentSchema.parse(req.body);

    const payment = await paymentService.verifyPayment(validatedData.reference);

    res.json({
      success: true,
      data: payment,
    });
  })
);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Paystack webhook events
 * @access  Public
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    // Verify webhook signature (in production)
    // const signature = req.headers['x-paystack-signature'] as string;
    
    // For now, process webhook without signature verification
    // In production, verify the signature with Paystack secret key
    await paymentService.handleWebhook(req.body);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  })
);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const payment = await paymentService.getPaymentById(req.params.id);

    res.json({
      success: true,
      data: payment,
    });
  })
);

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    Get payments by order
 * @access  Private
 */
router.get(
  '/order/:orderId',
  authenticate,
  asyncHandler(async (req, res) => {
    const payments = await paymentService.getPaymentsByOrder(req.params.orderId);

    res.json({
      success: true,
      data: payments,
    });
  })
);

/**
 * @route   GET /api/payments/user/me
 * @desc    Get payments for current user
 * @access  Private
 */
router.get(
  '/user/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }
    
    const payments = await paymentService.getPaymentsByUser(userId);

    res.json({
      success: true,
      data: payments,
    });
  })
);

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Refund payment
 * @access  Private (Admin only)
 */
router.post(
  '/:id/refund',
  authenticate,
  asyncHandler(async (req, res) => {
    // Check if user is admin
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'OWNER') {
      res.status(403).json({
        success: false,
        message: 'Only admins can process refunds',
      });
      return;
    }

    const validatedData = refundPaymentSchema.parse(req.body);

    const refund = await paymentService.refundPayment(
      req.params.id,
      validatedData.reason
    );

    res.json({
      success: true,
      data: refund,
    });
  })
);

export default router;
