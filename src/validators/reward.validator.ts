import { z } from 'zod';

// Validate reward code validator
export const validateRewardCodeSchema = z.object({
  code: z.string().min(1, 'Reward code is required'),
});

// Redeem reward code validator
export const redeemRewardCodeSchema = z.object({
  code: z.string().min(1, 'Reward code is required'),
});

// Create reward transaction validator (admin only)
export const createRewardTransactionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  type: z.enum(['EARN', 'REDEEM', 'BONUS', 'ADJUSTMENT']),
  points: z.number().int('Points must be an integer'),
  reason: z.string().min(1, 'Reason is required'),
  orderId: z.string().uuid('Invalid order ID').optional(),
});

// Types
export type ValidateRewardCodeInput = z.infer<typeof validateRewardCodeSchema>;
export type RedeemRewardCodeInput = z.infer<typeof redeemRewardCodeSchema>;
export type CreateRewardTransactionInput = z.infer<typeof createRewardTransactionSchema>;
