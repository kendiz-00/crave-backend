import { z } from 'zod';

export const initializePaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  email: z.string().email('Invalid email address'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'USSD', 'QR_CODE']).optional(),
});

export const verifyPaymentSchema = z.object({
  reference: z.string().min(1, 'Payment reference is required'),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  reason: z.string().optional(),
});

export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
