import request from 'supertest';
import { app } from '../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Checkout Endpoints', () => {
  let authToken: string;
  let userId: string;
  let cartId: string;
  let menuItemId: string;
  let addOnId: string;
  let rewardCodeId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'checkouttest@example.com',
        password: 'hashedpassword',
        firstName: 'Checkout',
        lastName: 'Test',
        phone: '+233201234567',
        role: 'CUSTOMER',
      },
    });
    userId = user.id;

    // Create menu item
    const menuItem = await prisma.menuItem.create({
      data: {
        name: 'Test Burger',
        description: 'Test burger for checkout',
        price: 50.00,
        categoryId: 'test-category-id',
        sku: 'TEST-BURGER-001',
        imageUrl: 'test.jpg',
        isAvailable: true,
      },
    });
    menuItemId = menuItem.id;

    // Create add-on
    const addOn = await prisma.addOn.create({
      data: {
        name: 'Test Cheese',
        price: 5.00,
        categoryId: 'test-category-id',
      },
    });
    addOnId = addOn.id;

    // Create reward code
    const rewardCode = await prisma.rewardCode.create({
      data: {
        userId,
        code: 'CRV-2024-TEST123',
        status: 'GENERATED',
        points: 10,
        discountValue: 10.00,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
    rewardCodeId = rewardCode.id;

    // Create cart with items
    const cart = await prisma.cart.create({
      data: {
        userId,
        status: 'ACTIVE',
        items: {
          create: [
            {
              menuItemId,
              quantity: 2,
              totalPrice: 110.00,
              addOns: {
                create: [
                  {
                    name: 'Test Cheese',
                    price: 5.00,
                  },
                ],
              },
            },
          ],
        },
      },
    });
    cartId = cart.id;

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'checkouttest@example.com',
        password: 'password123',
      });
    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.orderItem.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.rewardCode.delete({ where: { id: rewardCodeId } });
    await prisma.rewardTransaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.menuItem.delete({ where: { id: menuItemId } });
    await prisma.addOn.delete({ where: { id: addOnId } });
  });

  describe('POST /api/orders/checkout', () => {
    it('should create order from cart successfully', async () => {
      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
          notes: 'Test order',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order).toBeDefined();
      expect(res.body.order.orderNumber).toMatch(/^CRV-/);
      expect(res.body.order.status).toBe('PENDING');
      expect(res.body.order.rewardCodeGenerated).toBeDefined();
    });

    it('should apply reward code discount', async () => {
      // Create new cart for this test
      const cart = await prisma.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
          items: {
            create: [
              {
                menuItemId,
                quantity: 1,
                totalPrice: 50.00,
                addOns: {
                  create: [],
                },
              },
            ],
          },
        },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
          rewardCodeUsed: 'CRV-2024-TEST123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.discount).toBe(10);

      // Cleanup
      await prisma.orderItem.deleteMany({ where: { order: { userId } } });
      await prisma.order.deleteMany({ where: { userId } });
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await prisma.cart.delete({ where: { id: cart.id } });
    });

    it('should reject empty cart', async () => {
      // Create empty cart
      const emptyCart = await prisma.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('empty');

      // Cleanup
      await prisma.cart.delete({ where: { id: emptyCart.id } });
    });

    it('should reject unavailable menu item', async () => {
      // Make menu item unavailable
      await prisma.menuItem.update({
        where: { id: menuItemId },
        data: { isAvailable: false },
      });

      // Create new cart
      const cart = await prisma.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
          items: {
            create: [
              {
                menuItemId,
                quantity: 1,
                totalPrice: 50.00,
                addOns: { create: [] },
              },
            ],
          },
        },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('unavailable');

      // Cleanup
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await prisma.cart.delete({ where: { id: cart.id } });
      await prisma.menuItem.update({
        where: { id: menuItemId },
        data: { isAvailable: true },
      });
    });

    it('should reject expired reward code', async () => {
      // Create expired reward code
      const expiredCode = await prisma.rewardCode.create({
        data: {
          userId,
          code: 'CRV-2024-EXPIRED',
          status: 'GENERATED',
          points: 10,
          discountValue: 10.00,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
          rewardCodeUsed: 'CRV-2024-EXPIRED',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');

      // Cleanup
      await prisma.rewardCode.delete({ where: { id: expiredCode.id } });
    });

    it('should reject reward code from another user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'othercheckout@example.com',
          password: 'hashed',
          firstName: 'Other',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      // Create reward code for other user
      const otherCode = await prisma.rewardCode.create({
        data: {
          userId: otherUser.id,
          code: 'CRV-2024-OTHER',
          status: 'GENERATED',
          points: 10,
          discountValue: 10.00,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
          rewardCodeUsed: 'CRV-2024-OTHER',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('permission');

      // Cleanup
      await prisma.rewardCode.delete({ where: { id: otherCode.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/orders/checkout')
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
        });

      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          // Missing required fields
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Transaction Integrity', () => {
    it('should rollback on error', async () => {
      // This test verifies that the transaction rolls back on errors
      // Create cart with invalid item
      const invalidCart = await prisma.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
          items: {
            create: [
              {
                menuItemId,
                quantity: 1,
                totalPrice: 50.00,
                addOns: { create: [] },
              },
            ],
          },
        },
      });

      // Make menu item unavailable to trigger error
      await prisma.menuItem.update({
        where: { id: menuItemId },
        data: { isAvailable: false },
      });

      const res = await request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderType: 'PICKUP',
          customerName: 'Checkout Test',
          customerPhone: '+233201234567',
          customerEmail: 'checkouttest@example.com',
        });

      expect(res.status).toBe(400);

      // Verify cart was not checked out
      const cartAfter = await prisma.cart.findUnique({
        where: { id: invalidCart.id },
      });
      expect(cartAfter?.status).toBe('ACTIVE');

      // Cleanup
      await prisma.cartItem.deleteMany({ where: { cartId: invalidCart.id } });
      await prisma.cart.delete({ where: { id: invalidCart.id } });
      await prisma.menuItem.update({
        where: { id: menuItemId },
        data: { isAvailable: true },
      });
    });
  });
});
