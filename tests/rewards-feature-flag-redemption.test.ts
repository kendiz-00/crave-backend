import request from 'supertest';
import { createApp } from '../src/app';
import { PrismaClient, RewardClaimStatus } from '@prisma/client';
import {
  MILESTONE_100_REWARD_ID,
  setFreeDrinkRedemptionEnabled,
  isFreeDrinkRedemptionEnabled,
  PROPOSED_ELIGIBLE_FREE_DRINKS,
} from '../src/services/order.service';

const prisma = new PrismaClient();

describe('Stage 1 — Server-Side Feature Flag Verification (REWARDS_FREE_DRINK_REDEMPTION_ENABLED)', () => {
  let app: any;
  let testUser: any;
  let testToken: string;
  let category: any;
  let foodCategory: any;
  let drinkItem: any;
  let foodItem: any;

  beforeAll(async () => {
    app = createApp();

    // Isolated test user with 150 points (qualifies for 100 pt milestone)
    testUser = await prisma.user.create({
      data: {
        email: `flag_test_${Date.now()}@example.com`,
        password: 'hashedpassword',
        firstName: 'Flag',
        lastName: 'Tester',
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

    // Setup drink & food categories
    category = await prisma.category.upsert({
      where: { slug: 'smoothies' },
      update: {},
      create: { name: 'Smoothies', slug: 'smoothies' },
    });

    foodCategory = await prisma.category.upsert({
      where: { slug: 'burgers' },
      update: {},
      create: { name: 'Burgers', slug: 'burgers' },
    });

    drinkItem = await prisma.menuItem.create({
      data: {
        name: PROPOSED_ELIGIBLE_FREE_DRINKS[0].name,
        slug: `flag-drink-${Date.now()}`,
        description: 'Smoothie for testing',
        imageUrl: 'smoothie.jpg',
        price: 35.0,
        categoryId: category.id,
        isAvailable: true,
        preparationTime: 5,
      },
    });

    foodItem = await prisma.menuItem.create({
      data: {
        name: 'Gourmet Burger',
        slug: `flag-food-${Date.now()}`,
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
    // Ensure flag is reset to false
    setFreeDrinkRedemptionEnabled(false);

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

  describe('Control 1: Default to False on Missing, Malformed, or Unrecognized Values', () => {
    it('MUST evaluate to false when environment variable is missing, empty, or undefined', () => {
      delete process.env.REWARDS_FREE_DRINK_REDEMPTION_ENABLED;
      delete process.env.REWARDS_ELIGIBLE_DRINKS_ENABLED;
      expect(isFreeDrinkRedemptionEnabled()).toBe(false);
    });

    it('MUST evaluate to false when environment variable is malformed (e.g. "1", "yes", "truee", "TRUE", "enabled")', () => {
      const invalidValues = ['1', 'yes', 'truee', 'TRUE', 'enabled', '0', 'false', 'disabled', 'null'];
      for (const val of invalidValues) {
        process.env.REWARDS_FREE_DRINK_REDEMPTION_ENABLED = val;
        expect(isFreeDrinkRedemptionEnabled()).toBe(false);
      }
      delete process.env.REWARDS_FREE_DRINK_REDEMPTION_ENABLED;
    });

    it('MUST evaluate to true ONLY when environment variable is exact string "true"', () => {
      process.env.REWARDS_FREE_DRINK_REDEMPTION_ENABLED = 'true';
      expect(isFreeDrinkRedemptionEnabled()).toBe(true);
      delete process.env.REWARDS_FREE_DRINK_REDEMPTION_ENABLED;
    });
  });

  describe('Control 2: Direct API Checkout Rejection with REWARD_REDEMPTION_DISABLED', () => {
    beforeEach(async () => {
      setFreeDrinkRedemptionEnabled(false);
      await prisma.rewardClaim.deleteMany({ where: { userId: testUser.id } });
    });

    it('MUST reject direct API checkout with claimedRewardId returning HTTP 400 and code REWARD_REDEMPTION_DISABLED', async () => {
      // Ensure entitlement is earned and AVAILABLE
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: testUser.id,
          rewardId: MILESTONE_100_REWARD_ID,
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      await createCartForUser();

      // Attempt direct checkout bypassing frontend UI
      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Flag Tester',
          customerPhone: testUser.phone,
          claimedRewardId: claim.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('REWARD_REDEMPTION_DISABLED');
      expect(res.body.error?.message).toContain('Free drink reward redemption is currently disabled');

      // Verify the claim was NOT reserved, consumed, or expired
      const preservedClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(preservedClaim?.status).toBe(RewardClaimStatus.AVAILABLE);
      expect(preservedClaim?.orderId).toBeNull();
      expect(preservedClaim?.reservedAt).toBeNull();

      // Verify customer points and balances are 100% intact
      const preservedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(preservedUser?.lifetimePointsEarned).toBe(150);
    });

    it('MUST allow standard checkouts without rewards while free-drink redemption is disabled', async () => {
      setFreeDrinkRedemptionEnabled(false);
      await createCartForUser();

      // Normal order without reward claim
      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Flag Tester',
          customerPhone: testUser.phone,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.discount)).toBe(0);
      expect(Number(res.body.data.grandTotal)).toBe(105); // 65 + 35 + 5 tax

      // Clean up order
      await prisma.orderItem.deleteMany({ where: { orderId: res.body.data.id } });
      await prisma.order.delete({ where: { id: res.body.data.id } });
    });
  });

  describe('Control 3: Administrative Verification Endpoint (GET /api/rewards/redemption-status)', () => {
    it('MUST return redemptionEnabled: false and stable metadata without exposing secret keys or credentials', async () => {
      setFreeDrinkRedemptionEnabled(false);

      const res = await request(app)
        .get('/api/rewards/redemption-status')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.redemptionEnabled).toBe(false);
      expect(res.body.data.status).toBe('DISABLED');
      expect(res.body.data.code).toBe('REWARD_REDEMPTION_DISABLED');
      expect(res.body.data.reservationTtlSeconds).toBe(900);
      expect(res.body.data.proposedEligibleDrinksCount).toBe(10);

      // Verify no secrets exist in the response
      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toContain('DATABASE_URL');
      expect(responseString).not.toContain('JWT_SECRET');
      expect(responseString).not.toContain('PAYSTACK_SECRET');
      expect(responseString).not.toContain('BULKCLIX_API_KEY');
    });

    it('MUST return redemptionEnabled: true once explicitly activated', async () => {
      setFreeDrinkRedemptionEnabled(true);

      const res = await request(app)
        .get('/api/rewards/redemption-status')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.redemptionEnabled).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.code).toBe('REDEMPTION_ACTIVE');

      setFreeDrinkRedemptionEnabled(false);
    });
  });

  describe('Control 4: Eligible Drinks Endpoint Behavioral Alignment', () => {
    it('MUST return redemptionEnabled: false, empty eligibleProductIds, and PENDING_BUSINESS_APPROVAL when disabled', async () => {
      setFreeDrinkRedemptionEnabled(false);

      const res = await request(app)
        .get('/api/rewards/eligible-drinks')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.redemptionEnabled).toBe(false);
      expect(res.body.data.status).toBe('PENDING_BUSINESS_APPROVAL');
      expect(res.body.data.code).toBe('REWARD_REDEMPTION_DISABLED');
      expect(res.body.data.eligibleProductIds).toEqual([]);
      expect(res.body.data.eligibleDrinks).toEqual([]);
      expect(res.body.data.proposedItems.length).toBe(10);
    });
  });
});
