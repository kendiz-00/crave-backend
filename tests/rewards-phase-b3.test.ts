import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app';
import { PrismaClient, PaymentStatus, OrderStatus, RewardTransactionType } from '@prisma/client';
import { paymentService } from '../src/services/payment.service';
import { orderService, ELIGIBLE_FREE_DRINKS, MILESTONE_100_REWARD_ID } from '../src/services/order.service';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'Password123!';
const hashPassword = async (plainPassword: string) => bcrypt.hash(plainPassword, 10);

describe('Phase B3 Core Order & Payment Service Refactor Tests', () => {
  let app: any;
  let customerUser: any;
  let customerToken: string;
  let category: any;
  let eligibleDrinkItem: any;
  let otherMenuItem: any;

  beforeAll(async () => {
    app = createApp();

    // Create test customer
    const phone = `+23324${Math.floor(1000000 + Math.random() * 9000000)}`;
    customerUser = await prisma.user.create({
      data: {
        phone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        password: await hashPassword(TEST_PASSWORD),
        firstName: 'Loyal',
        lastName: 'Customer',
        role: 'CUSTOMER',
        lifetimePointsEarned: 0,
      },
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: phone, password: TEST_PASSWORD });
    customerToken = loginRes.body.data.tokens.accessToken;

    // Create category
    category = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        slug: `test-cat-${Date.now()}`,
        description: 'Test category description',
      },
    });

    // Create eligible drink item
    eligibleDrinkItem = await prisma.menuItem.create({
      data: {
        name: ELIGIBLE_FREE_DRINKS[0], // 'Strawberry Colada'
        slug: `strawberry-colada-${Date.now()}`,
        description: 'Delicious fresh smoothie',
        price: 35.00,
        categoryId: category.id,
        sku: `DRK-${Date.now()}-1`,
        imageUrl: 'smoothie.jpg',
        isAvailable: true,
        preparationTime: 10,
      },
    });

    // Create non-drink / other menu item
    otherMenuItem = await prisma.menuItem.create({
      data: {
        name: 'Jollof Rice with Grilled Chicken',
        slug: `jollof-rice-${Date.now()}`,
        description: 'Classic Ghanaian dish',
        price: 65.00,
        categoryId: category.id,
        sku: `JLF-${Date.now()}-2`,
        imageUrl: 'jollof.jpg',
        isAvailable: true,
        preparationTime: 20,
      },
    });
  });

  afterAll(async () => {
    await prisma.rewardTransaction.deleteMany({ where: { userId: customerUser.id } });
    await prisma.rewardClaim.deleteMany({ where: { userId: customerUser.id } });
    await prisma.payment.deleteMany({ where: { order: { userId: customerUser.id } } });
    await prisma.orderItemAddOn.deleteMany({});
    await prisma.orderItem.deleteMany({ where: { order: { userId: customerUser.id } } });
    await prisma.order.deleteMany({ where: { userId: customerUser.id } });
    await prisma.cartItemAddOn.deleteMany({});
    await prisma.cartItem.deleteMany({ where: { cart: { userId: customerUser.id } } });
    await prisma.cart.deleteMany({ where: { userId: customerUser.id } });
    await prisma.menuItem.deleteMany({ where: { id: { in: [eligibleDrinkItem.id, otherMenuItem.id] } } });
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.user.deleteMany({ where: { id: customerUser.id } });
  });

  beforeEach(async () => {
    await prisma.cartItemAddOn.deleteMany({});
    await prisma.cartItem.deleteMany({ where: { cart: { userId: customerUser.id } } });
    await prisma.cart.deleteMany({ where: { userId: customerUser.id } });
  });

  describe('Rule 1: No premature point earning at createOrder', () => {
    it('MUST NOT award reward points when order is created in PENDING status', async () => {
      // Create a cart for customer
      await prisma.cart.create({
        data: {
          userId: customerUser.id,
          status: 'ACTIVE',
          items: {
            create: [
              {
                menuItemId: otherMenuItem.id,
                quantity: 1,
                unitPrice: 65.00,
                totalPrice: 65.00,
              },
            ],
          },
        },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Loyal Customer',
          customerPhone: customerUser.phone,
        });

      expect(res.status).toBe(201);
      const order = res.body.data;
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.paymentStatus).toBe(PaymentStatus.PENDING);

      // Verify no EARN transaction was recorded
      const transactions = await prisma.rewardTransaction.findMany({
        where: { userId: customerUser.id, type: RewardTransactionType.EARN },
      });
      expect(transactions.length).toBe(0);

      // Verify user's balance and lifetimePointsEarned are still 0
      const user = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(user?.lifetimePointsEarned).toBe(0);
      const balance = await orderService.getUserRewardBalance(customerUser.id);
      expect(balance).toBe(0);
    });
  });

  describe('Rule 1, 2, 9 & Safeguard 1: Payment Verification, Idempotency, and Automatic 100-pt Unlock', () => {
    it('MUST award points only upon verified payment, unlock milestone at 100 pts, and prevent duplicate awarding', async () => {
      // Create an order for GHS 120
      const order = await prisma.order.create({
        data: {
          userId: customerUser.id,
          orderNumber: `CRV-TEST-${Date.now()}`,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          orderType: 'PICKUP',
          subtotal: 120.00,
          discount: 0,
          tax: 6.00,
          deliveryFee: 0,
          grandTotal: 126.00,
          rewardPointsEarned: 126,
          customerName: 'Loyal Customer',
          customerPhone: customerUser.phone,
        },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          reference: `PAY-TEST-${Date.now()}`,
          amount: 126.00,
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PENDING,
        },
      });

      // Mock Paystack verification
      const originalFetch = global.fetch;
      process.env.PAYSTACK_SECRET_KEY = 'test-secret';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Verification successful',
          data: { reference: payment.reference, status: 'success' },
        }),
      }) as typeof fetch;

      try {
        // First verification call
        const verifyRes = await request(app)
          .post('/api/payments/verify')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ reference: payment.reference });

        expect(verifyRes.status).toBe(200);

        // Verify points credited
        const updatedUser = await prisma.user.findUnique({ where: { id: customerUser.id } });
        expect(updatedUser?.lifetimePointsEarned).toBe(126);
        const balance = await orderService.getUserRewardBalance(customerUser.id);
        expect(balance).toBe(126);

        // Verify milestone 100 free drink was AUTOMATICALLY created with status AVAILABLE
        const milestoneClaim = await prisma.rewardClaim.findUnique({
          where: {
            userId_rewardId: {
              userId: customerUser.id,
              rewardId: MILESTONE_100_REWARD_ID,
            },
          },
        });
        expect(milestoneClaim).not.toBeNull();
        expect(milestoneClaim?.status).toBe('AVAILABLE');
        expect(milestoneClaim?.orderId).toBeNull();

        // Verify idempotency: duplicate verify request MUST NOT credit points again
        const duplicateRes = await request(app)
          .post('/api/payments/verify')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ reference: payment.reference });

        expect(duplicateRes.status).toBe(200);

        const afterDuplicateUser = await prisma.user.findUnique({ where: { id: customerUser.id } });
        expect(afterDuplicateUser?.lifetimePointsEarned).toBe(126); // Still 126!
        const transactions = await prisma.rewardTransaction.findMany({
          where: { userId: customerUser.id, orderId: order.id },
        });
        expect(transactions.length).toBe(1);

        // Rule 9: Reaching 200+ points must NOT recreate the milestone 100 claim
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: customerUser.id },
            data: { lifetimePointsEarned: 250 },
          });
        });
        const fullRewards = await orderService.getUserFullRewards(customerUser.id);
        const milestoneClaims = fullRewards.claims.filter((c: any) => c.rewardId === MILESTONE_100_REWARD_ID);
        expect(milestoneClaims.length).toBe(1);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Rule 3, 4, 5, 6, 7 & Safeguard 4: Milestone Redemption Lifecycle', () => {
    it('MUST reject redemption with ineligible drinks and accept only ELIGIBLE_FREE_DRINKS', async () => {
      const claim = await prisma.rewardClaim.findUnique({
        where: {
          userId_rewardId: {
            userId: customerUser.id,
            rewardId: MILESTONE_100_REWARD_ID,
          },
        },
      });
      expect(claim).not.toBeNull();

      // Cart with only Jollof Rice (ineligible for free drink)
      await prisma.cart.create({
        data: {
          userId: customerUser.id,
          status: 'ACTIVE',
          items: {
            create: [
              {
                menuItemId: otherMenuItem.id,
                quantity: 1,
                unitPrice: 65.00,
                totalPrice: 65.00,
              },
            ],
          },
        },
      });

      const resIneligible = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Loyal Customer',
          customerPhone: customerUser.phone,
          claimedRewardId: claim?.id,
        });

      expect(resIneligible.status).toBe(400);
      const errMsg = resIneligible.body.error?.message || resIneligible.body.message;
      expect(errMsg).toContain('does not contain an item eligible');
    });

    it('MUST atomically transition claim from AVAILABLE to RESERVED during createOrder and prevent concurrent double-reservation', async () => {
      const claim = await prisma.rewardClaim.findUnique({
        where: {
          userId_rewardId: {
            userId: customerUser.id,
            rewardId: MILESTONE_100_REWARD_ID,
          },
        },
      });

      // Create two carts to simulate concurrent checkouts with the same claim
      await prisma.cart.create({
        data: {
          userId: customerUser.id,
          status: 'ACTIVE',
          items: {
            create: [
              { menuItemId: eligibleDrinkItem.id, quantity: 1, unitPrice: 35.00, totalPrice: 35.00 },
              { menuItemId: otherMenuItem.id, quantity: 1, unitPrice: 65.00, totalPrice: 65.00 },
            ],
          },
        },
      });

      await prisma.cart.create({
        data: {
          userId: customerUser.id,
          status: 'ACTIVE',
          items: {
            create: [
              { menuItemId: eligibleDrinkItem.id, quantity: 1, unitPrice: 35.00, totalPrice: 35.00 },
              { menuItemId: otherMenuItem.id, quantity: 1, unitPrice: 65.00, totalPrice: 65.00 },
            ],
          },
        },
      });

      // Send both checkout requests concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/orders/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            orderType: 'PICKUP',
            customerName: 'Loyal Customer',
            customerPhone: customerUser.phone,
            claimedRewardId: claim?.id,
          }),
        request(app)
          .post('/api/orders/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            orderType: 'PICKUP',
            customerName: 'Loyal Customer',
            customerPhone: customerUser.phone,
            claimedRewardId: claim?.id,
          }),
      ]);

      const successCount = (res1.status === 201 ? 1 : 0) + (res2.status === 201 ? 1 : 0);
      const failCount = (res1.status === 400 ? 1 : 0) + (res2.status === 400 ? 1 : 0);

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify claim is now RESERVED to the successful order
      const successfulOrder = res1.status === 201 ? res1.body.data : res2.body.data;
      const updatedClaim = await prisma.rewardClaim.findUnique({ where: { id: claim?.id } });
      expect(updatedClaim?.status).toBe('RESERVED');
      expect(updatedClaim?.orderId).toBe(successfulOrder.id);
      expect(updatedClaim?.reservedAt).not.toBeNull();

      // Verify the free drink discount was applied to the order discount
      expect(Number(successfulOrder.discount)).toBe(35.00);
    });

    it('MUST permanently mark RESERVED claim as REDEEMED upon verified payment, and never allow reuse', async () => {
      const claim = await prisma.rewardClaim.findUnique({
        where: {
          userId_rewardId: {
            userId: customerUser.id,
            rewardId: MILESTONE_100_REWARD_ID,
          },
        },
      });
      expect(claim?.status).toBe('RESERVED');
      const orderId = claim?.orderId!;

      // Create payment for the reserved order
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      const payment = await prisma.payment.create({
        data: {
          orderId,
          reference: `PAY-RESERVE-${Date.now()}`,
          amount: Number(order?.grandTotal),
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PENDING,
        },
      });

      // Complete payment via orderService.processOrderPaymentSuccess
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.PAID, verifiedAt: new Date() },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.PAID, status: OrderStatus.CONFIRMED },
        });
        await orderService.processOrderPaymentSuccess(tx, orderId);
      });

      // Verify claim is now permanently REDEEMED
      const redeemedClaim = await prisma.rewardClaim.findUnique({ where: { id: claim?.id } });
      expect(redeemedClaim?.status).toBe('REDEEMED');
      expect(redeemedClaim?.redeemedAt).not.toBeNull();

      // Rule 7: Attempting to use this redeemed claim again MUST fail
      await prisma.cart.create({
        data: {
          userId: customerUser.id,
          status: 'ACTIVE',
          items: {
            create: [{ menuItemId: eligibleDrinkItem.id, quantity: 1, unitPrice: 35.00, totalPrice: 35.00 }],
          },
        },
      });

      const reuseRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Loyal Customer',
          customerPhone: customerUser.phone,
          claimedRewardId: claim?.id,
        });

      expect(reuseRes.status).toBe(400);
      const reuseErrMsg = reuseRes.body.error?.message || reuseRes.body.message;
      expect(reuseErrMsg).toContain('not available for redemption');
    });
  });

  describe('Rule 8: Reservation Release on Cancellation and Failure', () => {
    it('MUST release a RESERVED claim back to AVAILABLE when order is cancelled or payment fails', async () => {
      // Create a new claim in AVAILABLE state
      const customClaim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'milestone_free_dessert_250',
          status: 'AVAILABLE',
        },
      });

      const pendingOrder = await prisma.order.create({
        data: {
          userId: customerUser.id,
          orderNumber: `CRV-CANCEL-${Date.now()}`,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          orderType: 'PICKUP',
          subtotal: 50.00,
          discount: 10.00,
          tax: 2.50,
          deliveryFee: 0,
          grandTotal: 42.50,
          rewardPointsUsed: 5,
          customerName: 'Loyal Customer',
          customerPhone: customerUser.phone,
        },
      });

      // Reserve claim
      await prisma.rewardClaim.update({
        where: { id: customClaim.id },
        data: {
          status: 'RESERVED',
          orderId: pendingOrder.id,
          reservedAt: new Date(),
        },
      });

      // Cancel order
      await orderService.updateOrderStatus(pendingOrder.id, { status: OrderStatus.CANCELLED }, 'ADMIN');

      // Verify claim is released back to AVAILABLE and orderId is cleared
      const releasedClaim = await prisma.rewardClaim.findUnique({ where: { id: customClaim.id } });
      expect(releasedClaim?.status).toBe('AVAILABLE');
      expect(releasedClaim?.orderId).toBeNull();
      expect(releasedClaim?.reservedAt).toBeNull();

      // Clean up custom claim
      await prisma.rewardClaim.delete({ where: { id: customClaim.id } });
    });
  });

  describe('Safeguard 3: Proportional Refund Handling', () => {
    it('MUST calculate proportional point reversals and create compensating ADJUSTMENT ledger entries', async () => {
      // Create paid order with 100 points earned and 100 GHS grandTotal
      const order = await prisma.order.create({
        data: {
          userId: customerUser.id,
          orderNumber: `CRV-REFUND-${Date.now()}`,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          orderType: 'PICKUP',
          subtotal: 100.00,
          discount: 0,
          tax: 5.00,
          deliveryFee: 0,
          grandTotal: 100.00,
          rewardPointsEarned: 100,
          rewardPointsUsed: 10,
          customerName: 'Loyal Customer',
          customerPhone: customerUser.phone,
        },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          reference: `PAY-REFUND-${Date.now()}`,
          amount: 100.00,
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PAID,
        },
      });

      // Give user 100 earned points first
      await prisma.$transaction(async (tx) => {
        await orderService.createRewardTransaction(
          tx,
          customerUser.id,
          order.id,
          RewardTransactionType.EARN,
          100,
          'Earned points',
          `earn_order_${order.id}`,
        );
      });

      const userBefore = await prisma.user.findUnique({ where: { id: customerUser.id } });
      const lifetimeBefore = userBefore?.lifetimePointsEarned || 0;

      // Mock Paystack refund
      const originalFetch = global.fetch;
      process.env.PAYSTACK_SECRET_KEY = 'test-secret';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Refund has been queued',
          data: { status: 'processed' },
        }),
      }) as typeof fetch;

      try {
        // Execute a 50% partial refund (GHS 50 out of GHS 100)
        await paymentService.refundPayment(payment.id, 'Partial dissatisfaction', 50.00);

        // Proportional reversal: (50 / 100) * 100 = 50 points reversed
        const refundTx = await prisma.rewardTransaction.findFirst({
          where: {
            userId: customerUser.id,
            orderId: order.id,
            type: RewardTransactionType.ADJUSTMENT,
            points: -50,
          },
        });
        expect(refundTx).not.toBeNull();
        expect(refundTx?.points).toBe(-50);

        // Lifetime points decremented by 50
        const userAfter = await prisma.user.findUnique({ where: { id: customerUser.id } });
        expect(userAfter?.lifetimePointsEarned).toBe(lifetimeBefore - 50);

        // Spendable points used (10) restored via ADJUSTMENT
        const restoreTx = await prisma.rewardTransaction.findFirst({
          where: {
            userId: customerUser.id,
            orderId: order.id,
            type: RewardTransactionType.ADJUSTMENT,
            points: 10,
          },
        });
        expect(restoreTx).not.toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
