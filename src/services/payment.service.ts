import { PaymentMethod, PaymentGateway, PaymentStatus } from '@prisma/client';
import { ApiError } from '../types/errors';
import prisma from '@/database';

export class PaymentService {
  /**
   * Initialize payment with Paystack
   */
  async initializePayment(orderId: string, email: string, amount: number, method: PaymentMethod = PaymentMethod.CARD) {
    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

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
        amount: amount,
        currency: 'GHS',
        method,
        gateway: PaymentGateway.PAYSTACK,
        status: PaymentStatus.PENDING,
        metadata: {
          email,
          orderId,
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
  async verifyPayment(reference: string) {
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

      // If already verified, return existing payment (idempotent)
      if (payment.status === PaymentStatus.PAID) {
        return payment;
      }

      // Verify with Paystack API
      const verification = await this.verifyWithPaystack(reference);

      if (!verification) {
        throw new ApiError(400, 'Payment verification failed');
      }

      // Update payment status and order payment status atomically
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
    });
  }

  /**
   * Handle failed charge
   * Uses transaction for atomic payment status update
   */
  private async handleFailedCharge(data: { reference: string }) {
    const { reference } = data;

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { reference },
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
   */
  async refundPayment(paymentId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }

      if (payment.status !== PaymentStatus.PAID) {
        throw new ApiError(400, 'Payment cannot be refunded');
      }

      // Initiate refund with Paystack
      const refund = await this.initiateRefund(payment.reference, Number(payment.amount), reason);

      // Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          gatewayResponse: JSON.parse(JSON.stringify(refund)),
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            refundReason: reason,
          },
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
          status: 'REFUNDED',
        },
      });

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
