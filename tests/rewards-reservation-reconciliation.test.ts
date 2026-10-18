import request from 'supertest';
import { createApp } from '../src/app';
import { PrismaClient, PaymentStatus, OrderStatus, RewardClaimStatus } from '@prisma/client';
import {
  orderService,
  MILESTONE_100_REWARD_ID,
  setFreeDrinkEligibilityApproved,
  IS_FREE_DRINK_ELIGIBILITY_APPROVED,
  PROPOSED_ELIGIBLE_FREE_DRINKS,
} from '../src/services/order.service';

const prisma = new PrismaClient();

describe('Release Blockers Verification: Drink Approval Toggle & Reservation Reconciliation', () => {
  let app: any;
  let testUser: any;
  let testToken: string;
  let category: any;
  let foodItem: any;
  let drinkItem: any;

  beforeAll(async () => {
    app = createApp();

    // Setup isolated test user
    testUser = await prisma.user.create({
      data: {
        email: `reconcile_test_${Date.now()}@example.com`,
        password: 'hashedpassword',
        firstName: 'Reconcile',
        lastName: 'Test',
        phone: `+23324${Math.floor(1000000 + Math.random() * 9000000)}`,
        role: 'CUSTOMER',
        phoneVerified: true,
        lifetimePointsEarned: 150,
      },
    });

    const jwt = require('jsonwebtoken');
    testToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'test-secret-key-for-testing-only',
      { expiresIn: '1h' },
    );

    // Setup categories and menu items
    category = await prisma.category.upsert({
      where: { slug: 'smoothies' },
      update: {},
      create: { name: 'Smoothies', slug: 'smoothies' },
    });

    drinkItem = await prisma.menuItem.create({
      data: {
        name: PROPOSED_ELIGIBLE_FREE_DRINKS[0].name,
        slug: `reconcile-drink-${Date.now()}`,
        description: 'Smoothie for testing',
        imageUrl: 'smoothie.jpg',
        price: 35.0,
        categoryId: category.id,
        isAvailable: true,
        preparationTime: 5,
      },
    });

    const foodCategory = await prisma.category.upsert({
      where: { slug: 'burgers' },
      update: {},
      create: { name: 'Burgers', slug: 'burgers' },
    });

    foodItem = await prisma.menuItem.create({
      data: {
        name: 'Gourmet Burger',
        slug: `reconcile-food-${Date.now()}`,
        description: 'Burger for testing',
        imageUrl: 'burger.jpg',
        price: 65.0,
        categoryId: foodCategory.id,
        isAvailable: true,
        preparationTime: 10,
      },
    });
  });

  afterAll(async () => {
    // Reset approval flag
    setFreeDrinkEligibilityApproved(false);

    if (testUser) {
      await prisma.rewardClaim.deleteMany({ where: { userId: testUser.id } });
      await prisma.orderItem.deleteMany({ where: { order: { userId: testUser.id } } });
      await prisma.payment.deleteMany({ where: { order: { userId: testUser.id } } });
      await prisma.order.deleteMany({ where: { userId: testUser.id } });
      await prisma.cartItem.deleteMany({ where: { cart: { userId: testUser.id } } });
      await prisma.cart.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (drinkItem) await prisma.menuItem.delete({ where: { id: drinkItem.id } }).catch(() => {});
    if (foodItem) await prisma.menuItem.delete({ where: { id: foodItem.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  async function createCartForUser() {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: testUser.id } } });
    await prisma.cart.deleteMany({ where: { userId: testUser.id } });

    return await prisma.cart.create({
      data: {
        userId: testUser.id,
        status: 'ACTIVE',
        items: {
          create: [
            { menuItemId: foodItem.id, quantity: 1, unitPrice: 65.0, totalPrice: 65.0 },
            { menuItemId: drinkItem.id, quantity: 1, unitPrice: 35.0, totalPrice: 35.0 },
          ],
        },
      },
    });
  }

  describe('Blocker 1: Configurable & Disabled 10-Drink Eligibility Verification', () => {
    it('MUST return empty eligible list and PENDING_BUSINESS_APPROVAL when approval flag is disabled', async () => {
      setFreeDrinkEligibilityApproved(false);
      expect(IS_FREE_DRINK_ELIGIBILITY_APPROVED).toBe(false);

      const res = await request(app).get('/api/rewards/eligible-drinks').set('Authorization', `Bearer ${testToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isApproved).toBe(false);
      expect(res.body.data.status).toBe('PENDING_BUSINESS_APPROVAL');
      expect(res.body.data.eligibleProductIds).toEqual([]);
      expect(res.body.data.eligibleDrinks).toEqual([]);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.proposedItems.length).toBe(10);
    });

    it('MUST reject free drink redemption at checkout when eligibility is not yet approved', async () => {
      setFreeDrinkEligibilityApproved(false);

      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      await createCartForUser();

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Reconcile Tester',
          customerPhone: testUser.phone,
          claimedRewardId: claim.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toContain('pending business approval');

      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });

    it('MUST activate eligible drinks and allow checkout once explicitly approved', async () => {
      setFreeDrinkEligibilityApproved(true);
      expect(IS_FREE_DRINK_ELIGIBILITY_APPROVED).toBe(true);

      const catalogRes = await request(app).get('/api/rewards/eligible-drinks').set('Authorization', `Bearer ${testToken}`);
      expect(catalogRes.status).toBe(200);
      expect(catalogRes.body.data.isApproved).toBe(true);
      expect(catalogRes.body.data.status).toBe('ACTIVE');
      expect(catalogRes.body.data.items.length).toBe(10);

      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      try {
        await createCartForUser();

        const res = await request(app)
          .post('/api/orders/checkout')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            orderType: 'PICKUP',
            customerName: 'Reconcile Tester',
            customerPhone: testUser.phone,
            claimedRewardId: claim.id,
          });

        expect(res.status).toBe(201);
        // Prisma Decimal fields serialise as strings over JSON — coerce before asserting
        expect(Number(res.body.data.discount)).toBe(35);

        // Clean up order
        await prisma.orderItem.deleteMany({ where: { orderId: res.body.data.id } });
        await prisma.order.delete({ where: { id: res.body.data.id } });
      } finally {
        // Always remove the claim so the unique (userId, rewardId) constraint
        // does not bleed into the Blocker 2 tests even if an assertion throws.
        await prisma.rewardClaim.deleteMany({
          where: { userId: testUser.id, rewardId: MILESTONE_100_REWARD_ID },
        });
      }
    });
  });

  describe('Blocker 2: Safe Expiration and Payment-Aware Reconciliation', () => {
    beforeEach(async () => {
      setFreeDrinkEligibilityApproved(true);
      // Wipe any claim left over from a prior test so the unique (userId, rewardId)
      // constraint never blocks the upcoming prisma.rewardClaim.create() call.
      await prisma.rewardClaim.deleteMany({
        where: { userId: testUser.id, rewardId: MILESTONE_100_REWARD_ID },
      });
    });

    it('MUST NOT expire or release a reservation within the active 15-minute checkout window', async () => {
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.RESERVED,
          reservedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (within TTL)
        },
      });

      const reconciled = await orderService.reconcileClaimReservation(claim.id, testUser.id);
      expect(reconciled.status).toBe(RewardClaimStatus.RESERVED);

      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });

    it('MUST safely release an abandoned reservation older than 15 mins where no payment was initiated', async () => {
      // Create pending order with no payment record
      const abandonedOrder = await prisma.order.create({
        data: {
          orderNumber: 'CRV-TEST-ABANDONED-1',
          userId: testUser.id,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: 65,
          discount: 35,
          tax: 0,
          deliveryFee: 0,
          grandTotal: 30,
          customerName: 'Abandoned User',
          customerPhone: testUser.phone,
        },
      });

      // Claim reserved 20 minutes ago (expired)
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.RESERVED,
          reservedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago (expired)
          orderId: abandonedOrder.id,
        },
      });

      const reconciled = await orderService.reconcileClaimReservation(claim.id, testUser.id);
      expect(reconciled.status).toBe(RewardClaimStatus.AVAILABLE);
      expect(reconciled.orderId).toBeNull();
      expect(reconciled.reservedAt).toBeNull();

      // Verify abandoned order was cancelled
      const updatedOrder = await prisma.order.findUnique({ where: { id: abandonedOrder.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.CANCELLED);
      expect(updatedOrder?.paymentStatus).toBe(PaymentStatus.FAILED);

      // Clean up
      await prisma.order.delete({ where: { id: abandonedOrder.id } });
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });

    it('MUST permanently REDEEM and NEVER release an expired reservation if the order was PAID', async () => {
      // Create paid order
      const paidOrder = await prisma.order.create({
        data: {
          orderNumber: 'CRV-TEST-PAID-1',
          userId: testUser.id,
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          subtotal: 65,
          discount: 35,
          tax: 0,
          deliveryFee: 0,
          grandTotal: 30,
          customerName: 'Paid User',
          customerPhone: testUser.phone,
        },
      });

      // Claim reserved 45 minutes ago
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.RESERVED,
          reservedAt: new Date(Date.now() - 45 * 60 * 1000),
          orderId: paidOrder.id,
        },
      });

      const reconciled = await orderService.reconcileClaimReservation(claim.id, testUser.id);
      expect(reconciled.status).toBe(RewardClaimStatus.REDEEMED);
      expect(reconciled.orderId).toBe(paidOrder.id);

      // Clean up
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
      await prisma.order.delete({ where: { id: paidOrder.id } });
    });

    it('MUST automatically reconcile an expired reservation when customer re-attempts checkout', async () => {
      // Create an expired reservation with no payment initiated
      const oldOrder = await prisma.order.create({
        data: {
          orderNumber: 'CRV-TEST-RETRY-1',
          userId: testUser.id,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: 65,
          discount: 35,
          tax: 0,
          deliveryFee: 0,
          grandTotal: 30,
          customerName: 'Retry User',
          customerPhone: testUser.phone,
        },
      });

      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.RESERVED,
          reservedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
          orderId: oldOrder.id,
        },
      });

      // Create new cart for customer
      await createCartForUser();

      // Customer checks out again using the same claim — checkout should reconcile it and succeed!
      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Reconcile Tester',
          customerPhone: testUser.phone,
          claimedRewardId: claim.id,
        });

      expect(res.status).toBe(201);

      // Claim is now RESERVED for the NEW order!
      const updatedClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(updatedClaim?.status).toBe(RewardClaimStatus.RESERVED);
      expect(updatedClaim?.orderId).toBe(res.body.data.id);

      // Clean up
      await prisma.orderItem.deleteMany({ where: { orderId: res.body.data.id } });
      await prisma.order.delete({ where: { id: res.body.data.id } });
      await prisma.order.delete({ where: { id: oldOrder.id } });
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });
  });
});
