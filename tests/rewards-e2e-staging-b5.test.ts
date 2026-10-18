import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app';
import { PrismaClient, PaymentStatus, OrderStatus, RewardTransactionType, RewardClaimStatus } from '@prisma/client';
import { paymentService } from '../src/services/payment.service';
import { orderService, ELIGIBLE_FREE_DRINKS, ELIGIBLE_FREE_DRINK_IDS, PROPOSED_ELIGIBLE_FREE_DRINKS, MILESTONE_100_REWARD_ID, MILESTONE_CONFIG } from '../src/services/order.service';
import { OtpService } from '../src/services/otp.service';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'Password123!';
const hashPassword = async (plainPassword: string) => bcrypt.hash(plainPassword, 10);

describe('Phase B5 — End-to-End Staging Verification Suite', () => {
  let app: any;
  let customerUser: any;
  let customerToken: string;
  let customerPhone: string;
  let category: any;
  let eligibleDrinkItem: any;
  let foodMenuItem: any;
  let ineligibleDrinkItem: any;

  beforeAll(async () => {
    app = createApp();

    // Setup approved smoothie category (upsert to handle existing category)
    category = await prisma.category.upsert({
      where: { slug: 'smoothies' },
      update: {},
      create: {
        name: 'Smoothies',
        slug: 'smoothies',
        description: 'Test category for B5 smoothies',
      },
    });

    // Setup approved food category (upsert to handle existing category)
    const foodCategory = await prisma.category.upsert({
      where: { slug: 'burgers-combos' },
      update: {},
      create: {
        name: 'Burgers & Combos',
        slug: 'burgers-combos',
        description: 'Test category for B5 burgers & combos',
      },
    });

    // Create an eligible smoothie from ELIGIBLE_FREE_DRINKS whitelist
    eligibleDrinkItem = await prisma.menuItem.create({
      data: {
        name: ELIGIBLE_FREE_DRINKS[0], // 'Strawberry Colada'
        slug: `staging-strawberry-colada-${Date.now()}`,
        description: 'Approved CRAVE smoothie',
        price: 35.00,
        categoryId: category.id,
        sku: `DRK-B5-${Date.now()}-1`,
        imageUrl: 'smoothie.jpg',
        isAvailable: true,
        preparationTime: 10,
      },
    });

    // Create a qualifying food menu item in burgers-combos category
    foodMenuItem = await prisma.menuItem.create({
      data: {
        name: 'Texas Crispy Chicken Burger',
        slug: `staging-tx-burger-${Date.now()}`,
        description: 'Qualifying meal item',
        price: 65.00,
        categoryId: foodCategory.id,
        sku: `BRG-B5-${Date.now()}-2`,
        imageUrl: 'burger.jpg',
        isAvailable: true,
        preparationTime: 15,
      },
    });

    // Create an ineligible drink item (not on the 10-drink whitelist)
    ineligibleDrinkItem = await prisma.menuItem.create({
      data: {
        name: 'Unapproved Alcoholic Cocktail',
        slug: `staging-cocktail-${Date.now()}`,
        description: 'Drink not on the approved smoothie list',
        price: 45.00,
        categoryId: category.id,
        sku: `ALC-B5-${Date.now()}-3`,
        imageUrl: 'cocktail.jpg',
        isAvailable: true,
        preparationTime: 5,
      },
    });
  });

  afterAll(async () => {
    // Clean up test database records
    if (customerUser) {
      await prisma.rewardTransaction.deleteMany({ where: { userId: customerUser.id } });
      await prisma.rewardClaim.deleteMany({ where: { userId: customerUser.id } });
      await prisma.orderItem.deleteMany({ where: { order: { userId: customerUser.id } } });
      await prisma.payment.deleteMany({ where: { order: { userId: customerUser.id } } });
      await prisma.order.deleteMany({ where: { userId: customerUser.id } });
      await prisma.cartItem.deleteMany({ where: { cart: { userId: customerUser.id } } });
      await prisma.cart.deleteMany({ where: { userId: customerUser.id } });
      await prisma.user.delete({ where: { id: customerUser.id } }).catch(() => {});
    }

    if (eligibleDrinkItem) await prisma.menuItem.delete({ where: { id: eligibleDrinkItem.id } }).catch(() => {});
    if (foodMenuItem) await prisma.menuItem.delete({ where: { id: foodMenuItem.id } }).catch(() => {});
    if (ineligibleDrinkItem) await prisma.menuItem.delete({ where: { id: ineligibleDrinkItem.id } }).catch(() => {});

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear active carts before each test case
    if (customerUser) {
      await prisma.cartItem.deleteMany({ where: { cart: { userId: customerUser.id } } });
      await prisma.cart.deleteMany({ where: { userId: customerUser.id } });
    }
  });

  // Helper to add items to active cart
  async function populateCart(items: Array<{ menuItemId: string; quantity: number; unitPrice?: number }>) {
    const cart = await prisma.cart.create({
      data: {
        userId: customerUser.id,
        status: 'ACTIVE',
        items: {
          create: items.map(it => ({
            menuItemId: it.menuItemId,
            quantity: it.quantity,
            unitPrice: it.unitPrice || (it.menuItemId === eligibleDrinkItem.id ? 35.00 : 65.00),
            totalPrice: (it.unitPrice || (it.menuItemId === eligibleDrinkItem.id ? 35.00 : 65.00)) * it.quantity,
          })),
        },
      },
    });
    return cart;
  }

  // =========================================================================
  // JOURNEY STEP 1: Register / Login and Phone Verification
  // =========================================================================
  describe('Step 1: Customer Registration & Phone Verification Flow', () => {
    it('MUST verify phone number through OTP and register authenticated customer', async () => {
      customerPhone = `+23324${Math.floor(1000000 + Math.random() * 9000000)}`;

      // Simulate sending OTP
      const normalized = OtpService.normalizePhoneNumber(customerPhone);
      await prisma.phoneVerification.create({
        data: {
          phoneNumber: normalized,
          otp: await bcrypt.hash('123456', 10),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          attempts: 0,
          maxAttempts: 3,
        },
      });

      // Verify OTP via controller endpoint
      const verifyRes = await request(app)
        .post('/api/auth/phone/verify-otp')
        .send({ phoneNumber: customerPhone, otp: '123456' });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.verified).toBe(true);

      // Register new customer
      customerUser = await prisma.user.create({
        data: {
          phone: normalized,
          email: `b5_customer_${Date.now()}@example.com`,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          password: await hashPassword(TEST_PASSWORD),
          firstName: 'Staging',
          lastName: 'Customer',
          role: 'CUSTOMER',
          lifetimePointsEarned: 0,
        },
      });

      // Login to obtain JWT
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: customerPhone, password: TEST_PASSWORD });
      expect(loginRes.status).toBe(200);
      customerToken = loginRes.body.data.tokens.accessToken;
      expect(customerToken).toBeDefined();

      // Verify initial rewards state is zero
      const rewardsRes = await request(app)
        .get('/api/rewards')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(rewardsRes.status).toBe(200);
      expect(rewardsRes.body.data.points).toBe(0);
      expect(rewardsRes.body.data.lifetimePointsEarned).toBe(0);
      expect(rewardsRes.body.data.claims.length).toBe(0);
    });
  });

  // =========================================================================
  // JOURNEY STEP 2 & 3: Place & Pay Orders Until 100 Pts → Auto Unlock 1 Reward
  // =========================================================================
  describe('Step 2 & 3: Order Earning Progression & Automatic 100-Point Unlock', () => {
    it('MUST progress points only upon verified payment and auto-unlock exactly ONE milestone entitlement at 100 pts', async () => {
      // Order 1: Food meal @ 65 GHS
      await populateCart([{ menuItemId: foodMenuItem.id, quantity: 1 }]);
      const order1Res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'DELIVERY',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          deliveryAddress: '123 Crave Street, Accra',
        });
      expect(order1Res.status).toBe(201);
      const order1Id = order1Res.body.data.id;

      // In PENDING status, zero points awarded
      const midUser1 = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(midUser1?.lifetimePointsEarned).toBe(0);

      // Verify payment for Order 1 (65 meal + 3.25 tax = 68.25 grandTotal -> 68 pts)
      await prisma.$transaction(async (tx) => {
        await orderService.processOrderPaymentSuccess(tx, order1Id);
      });
      const afterOrder1User = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(afterOrder1User?.lifetimePointsEarned).toBe(68);

      // Order 2: Food meal @ 65 GHS (taking total to 68 + 68 = 136 pts >= 100 pts)
      await populateCart([{ menuItemId: foodMenuItem.id, quantity: 1 }]);
      const order2Res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'DELIVERY',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          deliveryAddress: '123 Crave Street, Accra',
        });
      expect(order2Res.status).toBe(201);
      const order2Id = order2Res.body.data.id;

      // Verify payment for Order 2
      await prisma.$transaction(async (tx) => {
        await orderService.processOrderPaymentSuccess(tx, order2Id);
      });
      const afterOrder2User = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(afterOrder2User?.lifetimePointsEarned).toBe(136);

      // Confirm milestone 100 claim was automatically unlocked in AVAILABLE status
      const claims = await prisma.rewardClaim.findMany({
        where: { userId: customerUser.id, rewardId: MILESTONE_100_REWARD_ID },
      });
      expect(claims.length).toBe(1);
      expect(claims[0].status).toBe(RewardClaimStatus.AVAILABLE);
      expect(claims[0].orderId).toBeNull();

      // Confirm points balance has ZERO deductions for unlocking the reward
      const fullRewards = await orderService.getUserFullRewards(customerUser.id);
      expect(fullRewards.points).toBe(136);

      // Simulate customer reaching higher milestone (e.g. 250 pts)
      await prisma.user.update({
        where: { id: customerUser.id },
        data: { lifetimePointsEarned: 250 },
      });
      await orderService.getUserFullRewards(customerUser.id);
      const claimsAfter250 = await prisma.rewardClaim.findMany({
        where: { userId: customerUser.id, rewardId: MILESTONE_100_REWARD_ID },
      });
      expect(claimsAfter250.length).toBe(1); // Never recreated
    });
  });

  // =========================================================================
  // JOURNEY STEP 4 & 5: Free Drink Selection, GH₵0 Drink, Kitchen Visibility
  // =========================================================================
  describe('Step 4 & 5: Free Drink Checkout, Kitchen Fulfillment, and Zero Point Deduction', () => {
    it('MUST apply free drink at GH₵0, preserve drink in order items, and deduct zero points', async () => {
      const claim = await prisma.rewardClaim.findFirstOrThrow({
        where: { userId: customerUser.id, rewardId: MILESTONE_100_REWARD_ID },
      });

      // Cart contains food meal (65 GHS) + eligible Strawberry Colada smoothie (35 GHS)
      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: eligibleDrinkItem.id, quantity: 1 },
      ]);

      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claim.id,
        });

      expect(checkoutRes.status).toBe(201);
      const order = checkoutRes.body.data;

      // Verify Pricing: Subtotal = 100, Discount = 35 (drink price), Tax (5% of 100) = 5.00, Grand Total = 70.00
      expect(Number(order.subtotal)).toBe(100);
      expect(Number(order.discount)).toBe(35);
      expect(Number(order.grandTotal)).toBe(70);

      // Verify Kitchen Visibility: Saved order items contains BOTH meal AND drink
      expect(order.items.length).toBe(2);
      const drinkItem = order.items.find((it: any) => it.menuItemId === eligibleDrinkItem.id);
      expect(drinkItem).toBeDefined();
      expect(drinkItem.snapshotName).toBe(eligibleDrinkItem.name);
      expect(drinkItem.quantity).toBe(1);

      // Verify Reservation: Claim transitioned to RESERVED and bound to this order
      const reservedClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(reservedClaim?.status).toBe(RewardClaimStatus.RESERVED);
      expect(reservedClaim?.orderId).toBe(order.id);
      expect(reservedClaim?.reservedAt).not.toBeNull();

      // Verify zero points deduction: User spendable points remain completely intact at 136
      const fullRewards = await orderService.getUserFullRewards(customerUser.id);
      expect(fullRewards.points).toBe(136);
    });
  });

  // =========================================================================
  // JOURNEY STEP 6 & 7: Permanent REDEEMED on Payment & Anti-Reuse Enforcement
  // =========================================================================
  describe('Step 6 & 7: One-Time Redemption and Strict Anti-Reuse Enforcement', () => {
    let activeOrderId: string;
    let claimId: string;

    it('MUST permanently mark entitlement REDEEMED upon verified payment', async () => {
      const claim = await prisma.rewardClaim.findFirstOrThrow({
        where: { userId: customerUser.id, rewardId: MILESTONE_100_REWARD_ID },
      });
      claimId = claim.id;
      activeOrderId = claim.orderId!;

      // Complete verified payment
      await prisma.$transaction(async (tx) => {
        await orderService.processOrderPaymentSuccess(tx, activeOrderId);
      });

      // Claim must be permanently REDEEMED
      const redeemedClaim = await prisma.rewardClaim.findUnique({ where: { id: claimId } });
      expect(redeemedClaim?.status).toBe(RewardClaimStatus.REDEEMED);
      expect(redeemedClaim?.redeemedAt).not.toBeNull();

      // Customer earns points from the paid meal portion (70.00 GHS = 70 pts)
      const user = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(user?.lifetimePointsEarned).toBe(250 + 70);
    });

    it('MUST reject any attempt to reuse the REDEEMED entitlement in a second order', async () => {
      // Cart for second order
      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: eligibleDrinkItem.id, quantity: 1 },
      ]);

      const reuseRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claimId, // Attempting to reuse already-redeemed claim
        });

      expect(reuseRes.status).toBe(400);
      const errMsg = reuseRes.body.error?.message || reuseRes.body.message;
      expect(errMsg).toContain('not available for redemption');
    });
  });

  // =========================================================================
  // JOURNEY STEP 8: Concurrency, Payment Failure, Abandonment, Duplicate Webhooks, Refunds
  // =========================================================================
  describe('Step 8: Edge Cases, Concurrency, Failure, and Reversal Safeguards', () => {
    it('MUST prevent race condition double-reservation under concurrent checkout attempts', async () => {
      // Clean up any stale ACTIVE carts from previous tests so findFirst returns our fresh cart
      await prisma.cart.updateMany({
        where: { userId: customerUser.id, status: 'ACTIVE' },
        data: { status: 'ABANDONED' },
      });

      // Create a fresh AVAILABLE claim with a configured reward ID
      const freshClaim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'milestone_concurrency_test_' + Date.now(),
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      MILESTONE_CONFIG[freshClaim.rewardId] = {
        points: 100,
        name: 'Free Drink',
        productIds: [...ELIGIBLE_FREE_DRINK_IDS],
        names: [...ELIGIBLE_FREE_DRINKS],
        categories: ['smoothies', 'smoothies-refreshers'],
      };

      // Create a single fresh cart — both concurrent requests will share it.
      // The cart.updateMany atomic lock ensures one wins 201, the other gets 400.
      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: eligibleDrinkItem.id, quantity: 1 },
      ]);

      const checkoutPayload = {
        orderType: 'PICKUP',
        customerName: 'Staging Customer',
        customerPhone: customerPhone,
        claimedRewardId: freshClaim.id,
      };

      // Fire 2 concurrent checkout requests
      const [res1, res2] = await Promise.all([
        request(app).post('/api/orders/checkout').set('Authorization', `Bearer ${customerToken}`).send(checkoutPayload),
        request(app).post('/api/orders/checkout').set('Authorization', `Bearer ${customerToken}`).send(checkoutPayload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      delete MILESTONE_CONFIG[freshClaim.rewardId];
      await prisma.rewardClaim.deleteMany({ where: { id: freshClaim.id } });
    });

    it('MUST release RESERVED claim back to AVAILABLE when payment fails or order is cancelled', async () => {
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'milestone_release_test_' + Date.now(),
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      // Temporarily register config mapping to use drink whitelist
      MILESTONE_CONFIG[claim.rewardId] = {
        points: 100,
        name: 'Free Drink',
        names: ELIGIBLE_FREE_DRINKS,
      };

      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: eligibleDrinkItem.id, quantity: 1 },
      ]);

      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claim.id,
        });
      expect(checkoutRes.status).toBe(201);
      const orderId = checkoutRes.body.data.id;

      // Claim is RESERVED
      let currentClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(currentClaim?.status).toBe(RewardClaimStatus.RESERVED);

      // Create pending payment
      const paymentRef = `test_ref_${Date.now()}`;
      await prisma.payment.create({
        data: {
          orderId,
          amount: 100.00,
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PENDING,
          reference: paymentRef,
        },
      });

      // Simulate payment failure webhook
      await paymentService.handleWebhook({
        event: 'charge.failed',
        data: { reference: paymentRef },
      });

      // Cancel order explicitly (as abandoned checkout)
      await orderService.updateOrderStatus(orderId, { status: OrderStatus.CANCELLED }, 'ADMIN');

      // Claim must be released back to AVAILABLE
      currentClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(currentClaim?.status).toBe(RewardClaimStatus.AVAILABLE);
      expect(currentClaim?.orderId).toBeNull();

      delete MILESTONE_CONFIG[claim.rewardId];
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });

    it('MUST handle duplicate webhooks idempotently without double-crediting points', async () => {
      await populateCart([{ menuItemId: foodMenuItem.id, quantity: 1 }]);
      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
        });
      const orderId = checkoutRes.body.data.id;

      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount: 65.00,
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PENDING,
          reference: `webhook_idemp_${Date.now()}`,
        },
      });

      // Deliver webhook first time
      await paymentService.handleWebhook({
        event: 'charge.success',
        data: { reference: payment.reference },
      });

      const userAfterFirst = await prisma.user.findUnique({ where: { id: customerUser.id } });
      const pts1 = userAfterFirst?.lifetimePointsEarned;

      // Deliver duplicate webhook second time
      await paymentService.handleWebhook({
        event: 'charge.success',
        data: { reference: payment.reference },
      });

      const userAfterSecond = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(userAfterSecond?.lifetimePointsEarned).toBe(pts1); // Zero point inflation
    });

    it('MUST calculate proportional point reversals and create compensating ADJUSTMENT ledger entries upon refund', async () => {
      await populateCart([{ menuItemId: foodMenuItem.id, quantity: 2 }]); // 130 GHS
      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
        });
      const orderId = checkoutRes.body.data.id;

      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount: 130.00,
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PAID,
          reference: `refund_test_${Date.now()}`,
        },
      });

      // Award points
      await prisma.$transaction(async (tx) => {
        await orderService.processOrderPaymentSuccess(tx, orderId);
      });

      const beforeRefundUser = await prisma.user.findUnique({ where: { id: customerUser.id } });
      const pointsBefore = beforeRefundUser?.lifetimePointsEarned || 0;

      // Mock Paystack refund HTTP call
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
        // Process 50% partial refund (65 GHS out of 130 GHS subtotal / 136.50 grandTotal)
        await paymentService.refundPayment(payment.id, 'Customer item out of stock', 65.00);

        const afterRefundUser = await prisma.user.findUnique({ where: { id: customerUser.id } });
        const pointsAfter = afterRefundUser?.lifetimePointsEarned || 0;

        // Proportional reversal: floor((65 / 136.50) * 136) = 64 points deducted
        expect(pointsBefore - pointsAfter).toBe(64);

        // Verify compensating ledger entry exists
        const adjTx = await prisma.rewardTransaction.findFirst({
          where: {
            userId: customerUser.id,
            orderId,
            type: RewardTransactionType.ADJUSTMENT,
          },
        });
        expect(adjTx).toBeDefined();
        expect(adjTx?.points).toBe(-64);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // JOURNEY STEP 9: Paystack Popup Closing vs Eventual Success
  // =========================================================================
  describe('Step 9: Paystack Popup Closing & Asynchronous Payment Completion', () => {
    it('MUST maintain RESERVED status when popup closes without error, and redeem upon background webhook', async () => {
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'milestone_async_test_' + Date.now(),
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      MILESTONE_CONFIG[claim.rewardId] = {
        points: 100,
        name: 'Free Drink',
        names: ELIGIBLE_FREE_DRINKS,
      };

      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: eligibleDrinkItem.id, quantity: 1 },
      ]);

      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claim.id,
        });
      expect(checkoutRes.status).toBe(201);
      const orderId = checkoutRes.body.data.id;

      // Customer closes Paystack modal on phone (asynchronous mobile money prompt pending)
      // On backend: Order is PENDING, Claim is RESERVED
      let currentClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(currentClaim?.status).toBe(RewardClaimStatus.RESERVED);

      // Reusing this claim while payment is pending is rejected
      const reuseAttempt = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claim.id,
        });
      expect(reuseAttempt.status).toBe(400);

      // 5 seconds later, Paystack webhook arrives confirming charge
      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount: 65.00,
          currency: 'GHS',
          method: 'CARD',
          gateway: 'PAYSTACK',
          status: PaymentStatus.PENDING,
          reference: `async_momo_${Date.now()}`,
        },
      });

      await paymentService.handleWebhook({
        event: 'charge.success',
        data: { reference: payment.reference },
      });

      // Claim is now permanently REDEEMED
      currentClaim = await prisma.rewardClaim.findUnique({ where: { id: claim.id } });
      expect(currentClaim?.status).toBe(RewardClaimStatus.REDEEMED);

      delete MILESTONE_CONFIG[claim.rewardId];
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });
  });

  // =========================================================================
  // JOURNEY STEP 10: Backward Compatibility with Legacy CLAIMED Records
  // =========================================================================
  describe('Step 10: API Compatibility & Support for Pre-Existing CLAIMED Records', () => {
    it('MUST seamlessly allow legacy pre-existing CLAIMED records to be reserved and redeemed', async () => {
      // Create a legacy claim with status: CLAIMED (pre-migration) for 100-pt free drink
      const legacyClaim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'milestone_legacy_claimed_' + Date.now(),
          status: RewardClaimStatus.CLAIMED,
        },
      });

      MILESTONE_CONFIG[legacyClaim.rewardId] = {
        points: 100,
        name: 'Free Drink',
        names: ELIGIBLE_FREE_DRINKS,
      };

      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: eligibleDrinkItem.id, quantity: 1 },
      ]);

      // Checkout with legacy claim
      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: legacyClaim.id,
        });
      expect(checkoutRes.status).toBe(201);
      const orderId = checkoutRes.body.data.id;

      // Legacy claim successfully transitions to RESERVED
      let claimState = await prisma.rewardClaim.findUnique({ where: { id: legacyClaim.id } });
      expect(claimState?.status).toBe(RewardClaimStatus.RESERVED);

      // Payment verifies and permanently marks it REDEEMED
      await prisma.$transaction(async (tx) => {
        await orderService.processOrderPaymentSuccess(tx, orderId);
      });
      claimState = await prisma.rewardClaim.findUnique({ where: { id: legacyClaim.id } });
      expect(claimState?.status).toBe(RewardClaimStatus.REDEEMED);

      delete MILESTONE_CONFIG[legacyClaim.rewardId];
      await prisma.rewardClaim.delete({ where: { id: legacyClaim.id } });
    });

    it('MUST expose GET /api/rewards/eligible-drinks with the exact 10 approved smoothies and product IDs', async () => {
      const res = await request(app)
        .get('/api/rewards/eligible-drinks')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eligibleDrinks.length).toBe(10);
      expect(res.body.data.eligibleProductIds.length).toBe(10);
      expect(res.body.data.items.length).toBe(10);
      expect(res.body.data.eligibleDrinks).toEqual(PROPOSED_ELIGIBLE_FREE_DRINKS.map((d) => d.name));
      expect(res.body.data.eligibleProductIds).toEqual(ELIGIBLE_FREE_DRINK_IDS);
    });
  });

  // =========================================================================
  // JOURNEY STEP 11: Drink Whitelist Strict Enforcement
  // =========================================================================
  describe('Step 11: Whitelist Enforcement & Rejection of Ineligible Drinks', () => {
    it('MUST strictly reject redemption when cart only contains ineligible drink', async () => {
      const claim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'test_claim_ineligible_' + Date.now(),
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      // Cart contains food + unapproved cocktail
      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: ineligibleDrinkItem.id, quantity: 1 },
      ]);

      // Temporary milestone config mapping for test
      MILESTONE_CONFIG[claim.rewardId] = {
        points: 100,
        name: 'Free Drink',
        productIds: ELIGIBLE_FREE_DRINK_IDS,
        names: ELIGIBLE_FREE_DRINKS,
      };

      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claim.id,
        });

      expect(checkoutRes.status).toBe(400);
      const errMsg = checkoutRes.body.error?.message || checkoutRes.body.message;
      expect(errMsg).toContain('does not contain an item eligible for Free Drink');

      delete MILESTONE_CONFIG[claim.rewardId];
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });

    it('MUST strictly reject excluded shakes when attempted as free drinks', async () => {
      const excludedShake = await prisma.menuItem.upsert({
        where: { slug: 'strawberry-bliss-shake-test' },
        update: {},
        create: {
          id: 'f6ff9d1d-5c82-4d3e-8313-d2ce0284fd73',
          name: 'Strawberry Bliss Shake',
          slug: 'strawberry-bliss-shake-test',
          price: 45.99,
          imageUrl: 'images/strawberry_bliss.jpg',
          preparationTime: 5,
          categoryId: category.id,
          isAvailable: true,
          description: 'Excluded shake from free drink offer',
        },
      });

      const claim = await prisma.rewardClaim.create({
        data: {
          userId: customerUser.id,
          rewardId: 'test_claim_shake_' + Date.now(),
          status: RewardClaimStatus.AVAILABLE,
        },
      });

      await populateCart([
        { menuItemId: foodMenuItem.id, quantity: 1 },
        { menuItemId: excludedShake.id, quantity: 1 },
      ]);

      MILESTONE_CONFIG[claim.rewardId] = {
        points: 100,
        name: 'Free Drink',
        productIds: ELIGIBLE_FREE_DRINK_IDS,
        names: PROPOSED_ELIGIBLE_FREE_DRINKS.map((d) => d.name),
      };

      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Staging Customer',
          customerPhone: customerPhone,
          claimedRewardId: claim.id,
        });

      expect(checkoutRes.status).toBe(400);
      const errMsg = checkoutRes.body.error?.message || checkoutRes.body.message;
      expect(errMsg).toContain('does not contain an item eligible for Free Drink');

      delete MILESTONE_CONFIG[claim.rewardId];
      await prisma.rewardClaim.delete({ where: { id: claim.id } });
    });

    it('MUST successfully discount each of the 10 proposed eligible drinks to GH₵0 for exactly 1 unit', async () => {
      // Test all 10 products
      for (const prod of PROPOSED_ELIGIBLE_FREE_DRINKS) {
        // Upsert menu item with authoritative ID
        const drinkItem = await prisma.menuItem.upsert({
          where: { id: prod.id },
          update: { isAvailable: true, isDeleted: false },
          create: {
            id: prod.id,
            name: prod.name,
            slug: 'test-slug-' + prod.id.substring(0, 8),
            price: 35.00,
            imageUrl: 'images/test_drink.jpg',
            preparationTime: 5,
            categoryId: category.id,
            isAvailable: true,
            description: 'Approved test smoothie',
          },
        });

        const testClaim = await prisma.rewardClaim.create({
          data: {
            userId: customerUser.id,
            rewardId: 'test_claim_prod_' + prod.id.substring(0, 8) + '_' + Date.now(),
            status: RewardClaimStatus.AVAILABLE,
          },
        });

        // Cart contains food + 1 unit of this eligible drink
        await populateCart([
          { menuItemId: foodMenuItem.id, quantity: 1 },
          { menuItemId: drinkItem.id, quantity: 1 },
        ]);

        MILESTONE_CONFIG[testClaim.rewardId] = {
          points: 100,
          name: 'Free Drink',
          productIds: ELIGIBLE_FREE_DRINK_IDS,
          names: ELIGIBLE_FREE_DRINKS,
        };

        const checkoutRes = await request(app)
          .post('/api/orders/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            orderType: 'PICKUP',
            customerName: 'Staging Customer',
            customerPhone: customerPhone,
            claimedRewardId: testClaim.id,
          });

        expect(checkoutRes.status).toBe(201);
        const orderData = checkoutRes.body.data;
        const drinkPrice = Number(drinkItem.price);
        expect(Number(orderData.discount)).toBe(drinkPrice);

        // Verify kitchen order and receipt items
        const kitchenDrink = orderData.items.find((it: any) => it.menuItemId === drinkItem.id);
        expect(kitchenDrink).toBeDefined();
        expect(kitchenDrink.snapshotName).toBe(prod.name);

        delete MILESTONE_CONFIG[testClaim.rewardId];
      }
    });
  });
});
