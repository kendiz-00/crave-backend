import request from 'supertest';
import { app } from '../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Cart Endpoints', () => {
  let authToken: string;
  let userId: string;
  let cartId: string;
  let menuItemId: string;
  let addOnId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'carttest@example.com',
        password: 'hashedpassword',
        firstName: 'Cart',
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
        description: 'Test burger for cart',
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

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'carttest@example.com',
        password: 'password123',
      });
    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.menuItem.delete({ where: { id: menuItemId } });
    await prisma.addOn.delete({ where: { id: addOnId } });
  });

  describe('POST /api/cart', () => {
    it('should create a new cart with items', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              menuItemId,
              quantity: 2,
              addOns: [
                {
                  addOnId,
                  name: 'Test Cheese',
                  price: 5.00,
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].quantity).toBe(2);
      cartId = res.body.cart.id;
    });

    it('should update existing cart', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              menuItemId,
              quantity: 3,
              addOns: [],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cart.items[0].quantity).toBe(3);
    });

    it('should reject invalid menu item', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              menuItemId: 'invalid-id',
              quantity: 1,
              addOns: [],
            },
          ],
        });

      expect(res.status).toBe(404);
    });

    it('should reject zero or negative quantity', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              menuItemId,
              quantity: 0,
              addOns: [],
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/cart')
        .send({
          items: [
            {
              menuItemId,
              quantity: 1,
              addOns: [],
            },
          ],
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/cart', () => {
    it('should get user active cart', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cart).toBeDefined();
      expect(res.body.summary).toBeDefined();
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/cart');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/cart/items/:id', () => {
    it('should update cart item quantity', async () => {
      const cartItem = await prisma.cartItem.findFirst({
        where: { cart: { userId } },
      });

      const res = await request(app)
        .patch(`/api/cart/items/${cartItem?.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 5,
          addOns: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cartItem.quantity).toBe(5);
    });

    it('should reject access to other user cart item', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashed',
          firstName: 'Other',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const otherCart = await prisma.cart.create({
        data: { userId: otherUser.id, status: 'ACTIVE' },
      });

      const otherCartItem = await prisma.cartItem.create({
        data: {
          cartId: otherCart.id,
          menuItemId,
          quantity: 1,
          totalPrice: 50.00,
        },
      });

      const res = await request(app)
        .patch(`/api/cart/items/${otherCartItem.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 2, addOns: [] });

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.cartItem.delete({ where: { id: otherCartItem.id } });
      await prisma.cart.delete({ where: { id: otherCart.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`/api/cart/items/some-id`)
        .send({ quantity: 2, addOns: [] });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/cart/items/:id', () => {
    it('should delete cart item', async () => {
      const cartItem = await prisma.cartItem.findFirst({
        where: { cart: { userId } },
      });

      const res = await request(app)
        .delete(`/api/cart/items/${cartItem?.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app).delete(`/api/cart/items/some-id`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/cart', () => {
    it('should clear cart', async () => {
      // Add item first
      await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              menuItemId,
              quantity: 1,
              addOns: [],
            },
          ],
        });

      const res = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify cart is empty
      const getRes = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.body.cart.items).toHaveLength(0);
    });

    it('should require authentication', async () => {
      const res = await request(app).delete('/api/cart');

      expect(res.status).toBe(401);
    });
  });
});
