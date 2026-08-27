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

// Create reward transaction validator (authenticated user)
export const createRewardTransactionForUserSchema = z.object({
  type: z.enum(['EARN', 'REDEEM', 'BONUS', 'ADJUSTMENT']),
  points: z.number().int('Points must be an integer').refine(val => val !== 0, 'Points cannot be zero'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters'),
  orderId: z.string().uuid('Invalid order ID').optional(),
  referenceId: z.string().max(100, 'Reference ID must not exceed 100 characters').optional(),
});

// Types
export type ValidateRewardCodeInput = z.infer<typeof validateRewardCodeSchema>;
export type RedeemRewardCodeInput = z.infer<typeof redeemRewardCodeSchema>;
export type CreateRewardTransactionInput = z.infer<typeof createRewardTransactionSchema>;
export type CreateRewardTransactionForUserInput = z.infer<typeof createRewardTransactionForUserSchema>;
