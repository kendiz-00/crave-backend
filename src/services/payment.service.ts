import { PaymentMethod, PaymentGateway, PaymentStatus } from '@prisma/client';
import { ApiError } from '../types/errors';
import { orderService } from './order.service';
import prisma from '@/database';

export function assertPaymentAmountMatchesOrder(submittedAmount: number, authoritativeAmount: number): void {
  if (!Number.isFinite(submittedAmount) || submittedAmount <= 0) {
    throw new ApiError(400, 'Payment amount must be a positive number');
  }
  if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
    throw new ApiError(400, 'Order total is not available for payment initialization');
  }
  if (Math.abs(submittedAmount - authoritativeAmount) > 0.01) {
    throw new ApiError(400, 'Payment amount does not match the verified order total');
  }
}

export class PaymentService {
  /**
   * Initialize payment with Paystack
   */
  async initializePayment(orderId: string, email: string, amount: number, method: PaymentMethod = PaymentMethod.CARD) {
    // Fetch the stored order and use its authoritative total instead of trusting
    // any client-submitted price or stale fallback value.
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    const authoritativeAmount = Number(order.grandTotal ?? 0);
    assertPaymentAmountMatchesOrder(amount, authoritativeAmount);

    // Check if order already has a pending payment
    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPayment) {
      return existingPayment;
    }

    // Generate payment reference
    const reference = this.generatePaymentReference();

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId,
        reference,
        amount: authoritativeAmount,
        currency: 'GHS',
        method,
        gateway: PaymentGateway.PAYSTACK,
        status: PaymentStatus.PENDING,
        metadata: {
          email,
          orderId,
          submittedAmount: amount,
          serverVerifiedAmount: authoritativeAmount,
        },
      },
    });

    // Return payment initialization data for frontend
    return {
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      email,
    };
  }

  /**
   * Verify payment with Paystack
   * Uses transaction to prevent race conditions and duplicate payments
   */
  async verifyPayment(reference: string, userId?: string) {
    // Use transaction to prevent race conditions
    return prisma.$transaction(async (tx) => {
      // Fetch payment from database with lock
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: { order: true },
      });

      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }

      if (userId && payment.order.userId !== userId) {
        throw new ApiError(403, 'You do not have permission to verify this payment');
      }

      // If already verified, return existing payment and complete any deferred claim
      // transition from an earlier deployment or retry.
      if (payment.status === PaymentStatus.PAID) {
        await orderService.processOrderPaymentSuccess(tx, payment.orderId);
        return payment;
      }

      // Verify with Paystack API
      const verification = await this.verifyWithPaystack(reference);

      if (!verification) {
        throw new ApiError(400, 'Payment verification failed');
      }

      // Update payment status, order payment status, and claim state atomically.
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          gatewayResponse: verification,
          verifiedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: 'CONFIRMED',
        },
      });
      await orderService.processOrderPaymentSuccess(tx, payment.orderId);

      return updatedPayment;
    });
  }

  /**
   * Handle payment webhook from Paystack
   */
  async handleWebhook(event: { event: string; data: unknown }) {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'charge.success':
        await this.handleSuccessfulCharge(data as { reference: string });
        break;
      case 'charge.failed':
        await this.handleFailedCharge(data as { reference: string });
        break;
      case 'transfer.success':
        await this.handleSuccessfulTransfer(data as unknown);
        break;
      case 'transfer.failed':
        await this.handleFailedTransfer(data as unknown);
        break;
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
  }

  /**
   * Handle successful charge
   * Uses transaction to ensure atomic payment and order status updates
   */
  private async handleSuccessfulCharge(data: { reference: string }) {
    const { reference } = data;

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: { order: true },
      });

      if (!payment) {
        console.error(`Payment not found for reference: ${reference}`);
        return;
      }

      if (payment.status === PaymentStatus.PAID) {
        await orderService.processOrderPaymentSuccess(tx, payment.orderId);
        return; // Already processed (idempotent)
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          gatewayResponse: data,
          verifiedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: 'CONFIRMED',
        },
      });
      await orderService.processOrderPaymentSuccess(tx, payment.orderId);
    });
  }

  /**
   * Handle failed charge
   * Uses transaction for atomic payment status update, reservation release, and point restoration
   */
  private async handleFailedCharge(data: { reference: string }) {
    const { reference } = data;

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: { order: true },
      });

      if (!payment) {
        console.error(`Payment not found for reference: ${reference}`);
        return;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          gatewayResponse: data,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.FAILED,
        },
      });

      // Release any RESERVED claim back to AVAILABLE
      await tx.rewardClaim.updateMany({
        where: {
          orderId: payment.orderId,
          status: 'RESERVED',
        },
        data: {
          status: 'AVAILABLE',
          reservedAt: null,
          orderId: null,
        },
      });

      // Restore spendable points if any were deducted at checkout
      const order = payment.order;
      if (order && order.rewardPointsUsed && order.rewardPointsUsed > 0) {
        const restoreRef = `restore_fail_${order.id}`;
        const existingRestore = await tx.rewardTransaction.findFirst({
          where: {
            userId: order.userId,
            referenceId: restoreRef,
          },
        });
        if (!existingRestore) {
          await orderService.createRewardTransaction(
            tx,
            order.userId,
            order.id,
            'ADJUSTMENT',
            order.rewardPointsUsed,
            `Restored spendable points from failed payment on order ${order.orderNumber}`,
            restoreRef,
          );
        }
      }
    });
  }

  /**
   * Handle successful transfer (for refunds)
   */
  private async handleSuccessfulTransfer(data: unknown) {
    // Implement refund handling if needed
    console.log('Transfer successful:', data);
  }

  /**
   * Handle failed transfer
   */
  private async handleFailedTransfer(data: unknown) {
    // Implement failed refund handling if needed
    console.log('Transfer failed:', data);
  }


  /**
   * Verify payment with Paystack API
   */
  private async verifyWithPaystack(reference: string) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new ApiError(500, 'Paystack secret key not configured');
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as { status: boolean; message?: string; data: unknown };

    if (!data.status) {
      throw new ApiError(400, data.message || 'Payment verification failed');
    }

    return data.data;
  }

  /**
   * Generate unique payment reference
   */
  private generatePaymentReference(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `CRV-${timestamp}-${random}`;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }

    return payment;
  }

  /**
   * Get payments by order
   */
  async getPaymentsByOrder(orderId: string) {
    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    return payments;
  }

  /**
   * Get payments by user
   */
  async getPaymentsByUser(userId: string) {
    const payments = await prisma.payment.findMany({
      where: {
        order: { userId },
      },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });

    return payments;
  }

  /**
   * Refund payment
   * Uses transaction to ensure atomic updates to payment and order status
   * Refund payment (supports full and partial refunds with proportional points reversal)
   * Uses transaction to ensure atomic updates to payment, order, and reward ledger
   */
  async refundPayment(paymentId: string, reason?: string, refundAmount?: number) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });

      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }

      if (payment.status !== PaymentStatus.PAID) {
        throw new ApiError(400, 'Payment cannot be refunded');
      }

      const totalPaymentAmount = Number(payment.amount);
      const effectiveRefundAmount = refundAmount !== undefined ? Math.min(refundAmount, totalPaymentAmount) : totalPaymentAmount;

      if (effectiveRefundAmount <= 0) {
        throw new ApiError(400, 'Refund amount must be greater than zero');
      }

      // Initiate refund with Paystack
      const refund = await this.initiateRefund(payment.reference, effectiveRefundAmount, reason);

      const isFullRefund = effectiveRefundAmount >= totalPaymentAmount - 0.01;

      // Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PAID,
          gatewayResponse: JSON.parse(JSON.stringify(refund)),
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            refundReason: reason,
            refundAmount: effectiveRefundAmount,
            isFullRefund,
          },
        },
      });

      // Update order status if fully refunded
      if (isFullRefund) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: PaymentStatus.REFUNDED,
            status: 'REFUNDED',
          },
        });
      }

      // Proportional points reversal
      const order = payment.order;
      if (order && order.userId) {
        const grandTotal = Number(order.grandTotal);
        const pointsEarned = order.rewardPointsEarned ?? 0;

        // Cumulative reversals already done for this order
        const existingReversals = await tx.rewardTransaction.aggregate({
          where: {
            orderId: order.id,
            type: 'ADJUSTMENT',
            points: { lt: 0 },
          },
          _sum: { points: true },
        });
        const alreadyReversed = Math.abs(existingReversals._sum.points || 0);
        const maxReversible = Math.max(0, pointsEarned - alreadyReversed);

        let pointsToReverse = 0;
        if (grandTotal > 0 && pointsEarned > 0 && maxReversible > 0) {
          // Proportional calculation: (refundAmount / grandTotal) * pointsEarned
          const calculatedReversal = Math.floor((effectiveRefundAmount / grandTotal) * pointsEarned);
          pointsToReverse = Math.min(maxReversible, calculatedReversal);
        }

        if (pointsToReverse > 0) {
          // Lock user row
          await tx.$queryRaw`
            SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE
          `;

          const lastTx = await tx.rewardTransaction.findFirst({
            where: { userId: order.userId },
            orderBy: { createdAt: 'desc' },
          });

          const currentRunning = lastTx?.runningBalance || 0;
          const newRunning = Math.max(0, currentRunning - pointsToReverse);

          await tx.rewardTransaction.create({
            data: {
              userId: order.userId,
              orderId: order.id,
              referenceId: `refund_adj_${payment.id}_${Date.now()}`,
              type: 'ADJUSTMENT',
              points: -pointsToReverse,
              runningBalance: newRunning,
              reason: `Points reversal for refund on order ${order.orderNumber}: -${pointsToReverse} points`,
            },
          });

          // Decrement lifetime points
          const user = await tx.user.findUnique({
            where: { id: order.userId },
            select: { lifetimePointsEarned: true },
          });
          if (user) {
            await tx.user.update({
              where: { id: order.userId },
              data: {
                lifetimePointsEarned: Math.max(0, user.lifetimePointsEarned - pointsToReverse),
              },
            });
          }
        }

        // Restore spendable points used on this order (for full refunds or first refund)
        if (order.rewardPointsUsed && order.rewardPointsUsed > 0) {
          const restoreRef = `refund_restore_points_${order.id}`;
          const existingRestore = await tx.rewardTransaction.findFirst({
            where: {
              userId: order.userId,
              referenceId: restoreRef,
            },
          });

          if (!existingRestore) {
            const lastTxAfterReversal = await tx.rewardTransaction.findFirst({
              where: { userId: order.userId },
              orderBy: { createdAt: 'desc' },
            });
            const curBal = lastTxAfterReversal?.runningBalance || 0;

            await tx.rewardTransaction.create({
              data: {
                userId: order.userId,
                orderId: order.id,
                referenceId: restoreRef,
                type: 'ADJUSTMENT',
                points: order.rewardPointsUsed,
                runningBalance: curBal + order.rewardPointsUsed,
                reason: `Restored spendable points from refunded order ${order.orderNumber}`,
              },
            });
          }
        }
      }

      return refund;
    });
  }

  /**
   * Initiate refund with Paystack
   */
  private async initiateRefund(reference: string, amount: number, reason?: string) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new ApiError(500, 'Paystack secret key not configured');
    }

    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: reference,
        amount: amount * 100, // Convert to kobo
        reason,
      }),
    });

    const data = await response.json() as { status: boolean; message?: string; data: unknown };

    if (!data.status) {
      throw new ApiError(400, data.message || 'Refund initiation failed');
    }

    return data.data;
  }
}

export const paymentService = new PaymentService();
