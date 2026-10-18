import { Router } from 'express';
import { orderController } from '../controllers';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorization.middleware';

const router = Router();

// All reward routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/rewards
 * @desc    Get user's full reward state
 * @access  Private
 */
router.get('/', orderController.getRewards);

/**
 * @route   GET /api/rewards/balance
 * @desc    Get user's reward balance
 * @access  Private
 */
router.get('/balance', orderController.getRewardBalance);

/**
 * @route   GET /api/rewards/history
 * @desc    Get user's reward history
 * @access  Private
 */
router.get('/history', orderController.getRewardHistory);

/**
 * @route   POST /api/rewards/transactions
 * @desc    Create a reward transaction (Admin/Owner only - prevents arbitrary point minting)
 * @access  Private (Admin/Owner)
 */
router.post('/transactions', authorize('ADMIN', 'OWNER'), orderController.createRewardTransaction);

/**
 * @route   POST /api/rewards/claims
 * @desc    Claim a milestone reward for the authenticated user
 * @access  Private
 */
router.post('/claims', orderController.claimReward);

export default router;
