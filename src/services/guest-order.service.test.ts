import { GuestOrderService } from './guest-order.service';
import { OrderStatus, PromoCodeStatus } from '@prisma/client';
import prisma from '@/database';

describe('GuestOrderService', () => {
  let guestOrderService: GuestOrderService;
  let testMenuItemId: string;
  let testPromoCodeId: string;
  let testPromoCodeId2: string; // For concurrency test

  beforeAll(async () => {
    guestOrderService = new GuestOrderService();

    // Create a test category
    const testCategory = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category-guest',
      },
    });

    // Create a test menu item
    const testMenuItem = await prisma.menuItem.create({
      data: {
        name: 'Test Guest Item',
        slug: 'test-guest-item',
        description: 'Test item for guest orders',
        price: 50,
        imageUrl: 'test.jpg',
        preparationTime: 15,
        categoryId: testCategory.id,
      },
    });

    testMenuItemId = testMenuItem.id;

    // Create test promo codes (for concurrency test)
    const testPromoCode1 = await prisma.promoCode.create({
      data: {
        code: 'CONCURRENT1',
        name: 'Concurrent Test 1',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        usageLimit: 1, // Only 1 use for testing concurrency
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: 'test-admin',
        status: PromoCodeStatus.ACTIVE,
      },
    });

    testPromoCodeId = testPromoCode1.id;

    const testPromoCode2 = await prisma.promoCode.create({
      data: {
        code: 'CONCURRENT2',
        name: 'Concurrent Test 2',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        usageLimit: 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: 'test-admin',
        status: PromoCodeStatus.ACTIVE,
      },
    });

    testPromoCodeId2 = testPromoCode2.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.orderReservation.deleteMany({});
    await prisma.order.deleteMany({
      where: { orderNumber: { startsWith: 'CRV-' } },
    });
    await prisma.promoCode.deleteMany({
      where: { code: { in: ['CONCURRENT1', 'CONCURRENT2'] } },
    });
    await prisma.menuItem.delete({
      where: { id: testMenuItemId },
    });
    await prisma.category.deleteMany({
      where: { slug: 'test-category-guest' },
    });
  });

  describe('createGuestOrder', () => {
    it('should create a guest order without authentication', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 2,
            addOns: [],
          },
        ],
        customerName: 'Guest Customer',
        customerPhone: '+233500000001',
        customerEmail: 'guest@example.com',
        promoCodeUsed: null,
      };

      const result = await guestOrderService.createGuestOrder(orderData);

      expect(result.isDuplicate).toBe(false);
      expect(result.order).toBeDefined();
      expect(result.order.customerName).toBe('Guest Customer');
      expect(result.order.customerPhone).toBe('+233500000001');
      expect(result.order.status).toBe(OrderStatus.PENDING);
      expect(result.order.userId).toBeNull(); // Guest order
    });

    it('should validate promo code and create reservation for last use', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Guest Customer',
        customerPhone: '+233500000002',
        promoCodeUsed: 'CONCURRENT1',
      };

      const result = await guestOrderService.createGuestOrder(orderData);

      expect(result.isDuplicate).toBe(false);
      expect(result.promoReservation).toBeDefined();
      expect(result.promoReservation.status).toBe('RESERVED');
      expect(result.order.promoCodeUsed).toBe('CONCURRENT1');
    });

    it('should return existing order on duplicate submission with same key', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Duplicate Test',
        customerPhone: '+233500000003',
        idempotencyKey: 'test-idempotency-key-123',
      };

      // First order
      const result1 = await guestOrderService.createGuestOrder(orderData);
      expect(result1.isDuplicate).toBe(false);

      // Duplicate submission
      const result2 = await guestOrderService.createGuestOrder(orderData);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.order.id).toBe(result1.order.id);
    });

    it('should reject different payload with same idempotency key', async () => {
      const orderData1 = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Collision Test',
        customerPhone: '+233500000004',
        idempotencyKey: 'test-collision-key-456',
      };

      await guestOrderService.createGuestOrder(orderData1);

      const orderData2 = {
        ...orderData1,
        customerName: 'Different Name',
        quantity: 2,
      };

      await expect(
        guestOrderService.createGuestOrder(orderData2)
      ).rejects.toThrow('Duplicate order detected');
    });

    it('should prevent impersonation with userId', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Imposter Test',
        customerPhone: '+233500000005',
        userId: '00000000-0000-0000-0000-000000000001', // Different user
      };

      // Simulate authenticated user
      const authenticatedUserId = '00000000-0000-0000-0000-000000000002';

      await expect(
        guestOrderService.createGuestOrder(orderData, authenticatedUserId)
      ).rejects.toThrow('Cannot impersonate another user');
    });

    it('should prevent impersonation with userEmail', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Email Imposter',
        customerPhone: '+233500000006',
        userEmail: 'imposter@example.com',
      };

      // Simulate authenticated user
      const authenticatedUserEmail = 'real@example.com';

      await expect(
        guestOrderService.createGuestOrder(orderData, undefined, authenticatedUserEmail)
      ).rejects.toThrow('Cannot use another user\'s email');
    });

    it('should respect user restrictions from verified identity', async () => {
      const restrictedUserId = '00000000-0000-0000-0000-000000000003';

      // Create restricted promo code
      const restrictedPromo = await prisma.promoCode.create({
        data: {
          code: 'RESTRICTED1',
          name: 'Restricted Test',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          usageLimit: 5,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdBy: 'test-admin',
          status: PromoCodeStatus.ACTIVE,
          restrictedUserIds: [restrictedUserId],
        },
      });

      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Restricted Test',
        customerPhone: '+233500000007',
        promoCodeUsed: 'RESTRICTED1',
        userId: '00000000-0000-0000-0000-000000000004', // Different user
      };

      await expect(
        guestOrderService.createGuestOrder(orderData)
      ).rejects.toThrow('This promo code is not available for your account');

      // Cleanup
      await prisma.promoCode.delete({ where: { id: restrictedPromo.id } });
    });
  });

  describe('concurrent usage limits', () => {
    it('should prevent concurrent requests from exceeding usage limit', async () => {
      const orderData1 = {
        orderType: 'CURRENT',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Concurrent 1',
        customerPhone: '+233500000008',
        promoCodeUsed: 'CONCURRENT1',
      };

      const orderData2 = {
        orderType: 'CURRENT',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Concurrent 2',
        customerPhone: '+233500000009',
        promoCodeUsed: 'CONCURRENT1',
      };

      // Create first order (should succeed)
      const result1 = await guestOrderService.createGuestOrder(orderData1);
      expect(result1.isDuplicate).toBe(false);
      expect(result1.order.promoCodeUsed).toBe('CONCURRENT1');

      // Create second order (should fail - usage limit reached)
      await expect(
        guestOrderService.createGuestOrder(orderData2)
      ).rejects.toThrow('Promo code has reached its usage limit');

      // Verify usage count is still 1
      const promoCode = await prisma.promoCode.findUnique({
        where: { code: 'CONCURRENT1' },
      });
      expect(promoCode.usageCount).toBe(1);
    });
  });

  describe('cancelGuestOrder', () => {
    it('should cancel order and release promo reservation', async () => {
      // Create order with promo reservation
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Cancel Test',
        customerPhone: '+233500000010',
        promoCodeUsed: 'CONCURRENT2',
      };

      const result = await guestOrderService.createGuestOrder(orderData);
      expect(result.promoReservation).toBeDefined();

      // Cancel order
      const cancelResult = await guestOrderService.cancelGuestOrder(result.order.id);
      expect(cancelResult.message).toBe('Order cancelled');

      // Verify order is cancelled
      const order = await prisma.order.findUnique({
        where: { id: result.order.id },
      });
      expect(order.status).toBe(OrderStatus.CANCELLED);

      // Verify reservation is cancelled
      const reservation = await prisma.orderReservation.findUnique({
        where: { id: result.promoReservation.id },
      });
      expect(reservation.status).toBe('CANCELLED');

      // Verify usage count is restored
      const promoCode = await prisma.promoCode.findUnique({
        where: { code: 'CONCURRENT2' },
      });
      expect(promoCode.usageCount).toBe(0);
    });

    it('should only allow cancellation of pending orders', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Cancel Fail Test',
        customerPhone: '+233500000011',
      };

      const result = await guestOrderService.createGuestOrder(orderData);

      // Mark as confirmed
      await prisma.order.update({
        where: { id: result.order.id },
        data: { status: OrderStatus.CONFIRMED },
      });

      // Try to cancel
      await expect(
        guestOrderService.cancelGuestOrder(result.order.id)
      ).rejects.toThrow('Can only cancel pending orders');
    });
  });

  describe('confirmGuestOrder', () => {
    it('should confirm order and consume promo usage', async () => {
      // Create order with promo reservation
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Confirm Test',
        customerPhone: '+233500000012',
        promoCodeUsed: 'CONCURRENT2',
      };

      const result = await guestOrderService.createGuestOrder(orderData);
      expect(result.promoReservation).toBeDefined();

      // Get initial usage count
      const promoBefore = await prisma.promoCode.findUnique({
        where: { code: 'CONCURRENT2' },
      });
      const usageBefore = promoBefore.usageCount;

      // Confirm order
      const confirmResult = await guestOrderService.confirmGuestOrder(result.order.id);
      expect(confirmResult.message).toBe('Order confirmed');

      // Verify order is confirmed
      const order = await prisma.order.findUnique({
        where: { id: result.order.id },
      });
      expect(order.status).toBe(OrderStatus.CONFIRMED);

      // Verify reservation is consumed
      const reservation = await prisma.orderReservation.findUnique({
        where: { id: result.promoReservation.id },
      });
      expect(reservation.status).toBe('CONSUMED');
      expect(reservation.consumed).toBe(true);

      // Verify usage count incremented
      const promoAfter = await prisma.promoCode.findUnique({
        where: { code: 'CONCURRENT2' },
      });
      expect(promoAfter.usageCount).toBe(usageBefore + 1);
    });

    it('should only confirm pending orders', async () => {
      const orderData = {
        orderType: 'PICKUP',
        items: [
          {
            menuItemId: testMenuItemId,
            quantity: 1,
            addOns: [],
          },
        ],
        customerName: 'Confirm Fail Test',
        customerPhone: '+233500000013',
      };

      const result = await guestOrderService.createGuestOrder(orderData);

      // Mark as cancelled
      await prisma.order.update({
        where: { id: result.order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      // Try to confirm
      await expect(
        guestOrderService.confirmGuestOrder(result.order.id)
      ).rejects.toThrow('Order is not pending');
    });
  });

  describe('cleanupExpiredReservations', () => {
    it('should clean up expired reservations and restore usage', async () => {
      // Create promo code with 2 uses
      const testPromo = await prisma.promoCode.create({
        data: {
          code: 'EXPIRYTEST',
          name: 'Expiry Test',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          usageLimit: 2,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdBy: 'test-admin',
          status: PromoCodeStatus.ACTIVE,
        },
      });

      // Create expired reservation (expired in the past)
      const expiredReservation = await prisma.orderReservation.create({
        data: {
          promoCodeId: testPromo.id,
          promoCode: 'EXPIRYTEST',
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          status: 'RESERVED',
        },
      });

      // Increment usage to simulate consumed
      await prisma.promoCode.update({
        where: { id: testPromo.id },
        data: { usageCount: 1 },
      });

      // Run cleanup
      const result = await guestOrderService.cleanupExpiredReservations();

      expect(result.released).toBeGreaterThanOrEqual(1);

      // Verify reservation marked as expired
      const reservation = await prisma.orderReservation.findUnique({
        where: { id: expiredReservation.id },
      });
      expect(reservation.status).toBe('EXPIRED');

      // Verify usage count restored
      const promo = await prisma.promoCode.findUnique({
        where: { id: testPromo.id },
      });
      expect(promo.usageCount).toBe(0);

      // Cleanup
      await prisma.promoCode.delete({ where: { id: testPromo.id } });
      await prisma.orderReservation.delete({ where: { id: expiredReservation.id } });
    });
  });
});
