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
 * @route   GET /api/rewards/eligible-drinks
 * @desc    Return the backend-controlled list of drink names eligible for the 100-point milestone reward.
 *          Frontend must use this list and must not maintain its own conflicting copy.
 * @access  Private
 */
router.get('/eligible-drinks', orderController.getEligibleDrinks);

/**
 * @route   GET /api/rewards/redemption-status
 * @desc    Get the administrative verification status of the free-drink redemption feature flag
 *          without exposing secret keys or environment variables.
 * @access  Private
 */
router.get('/redemption-status', orderController.getRedemptionStatus);

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
