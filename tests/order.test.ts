import request from 'supertest';
import { app } from '../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Order Endpoints', () => {
  let authToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;
  let orderId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'ordertest@example.com',
        password: 'hashedpassword',
        firstName: 'Order',
        lastName: 'Test',
        phone: '+233201234567',
        role: 'CUSTOMER',
      },
    });
    userId = user.id;

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: 'hashedpassword',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+233201234568',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;

    // Login to get tokens
    const userLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ordertest@example.com',
        password: 'password123',
      });
    authToken = userLoginRes.body.data.accessToken;

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123',
      });
    adminToken = adminLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.orderItem.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: adminId } });
  });

  describe('GET /api/orders/my-orders', () => {
    it('should get user orders', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.orders).toBeDefined();
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/orders/my-orders');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by ID for owner', async () => {
      // Create an order first
      const order = await prisma.order.create({
        data: {
          userId,
          orderNumber: 'CRV-2024-TEST001',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          orderType: 'PICKUP',
          subtotal: 50.00,
          discount: 0,
          tax: 2.50,
          deliveryFee: 0,
          grandTotal: 52.50,
          customerName: 'Order Test',
          customerPhone: '+233201234567',
          customerEmail: 'ordertest@example.com',
        },
      });
      orderId = order.id;

      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.id).toBe(orderId);
    });

    it('should reject access to other user order', async () => {
      // Create another user and order
      const otherUser = await prisma.user.create({
        data: {
          email: 'otherorder@example.com',
          password: 'hashed',
          firstName: 'Other',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const otherOrder = await prisma.order.create({
        data: {
          userId: otherUser.id,
          orderNumber: 'CRV-2024-TEST002',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          orderType: 'PICKUP',
          subtotal: 50.00,
          discount: 0,
          tax: 2.50,
          deliveryFee: 0,
          grandTotal: 52.50,
          customerName: 'Other User',
          customerPhone: '+233201234569',
          customerEmail: 'otherorder@example.com',
        },
      });

      const res = await request(app)
        .get(`/api/orders/${otherOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.order.delete({ where: { id: otherOrder.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should allow admin to access any order', async () => {
      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app).get(`/api/orders/${orderId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('should update order status as admin', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.status).toBe('PREPARING');
    });

    it('should reject status update from customer', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'READY' });

      expect(res.status).toBe(403);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'READY' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/orders/:id/payment', () => {
    it('should update payment status as admin', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentStatus: 'PAID' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.paymentStatus).toBe('PAID');
    });

    it('should reject payment update from customer', async () => {
      const res = await request(app)
        .patch(`/api/orders/${orderId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentStatus: 'PAID' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should cancel pending order as owner', async () => {
      // Create pending order
      const pendingOrder = await prisma.order.create({
        data: {
          userId,
          orderNumber: 'CRV-2024-TEST003',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          orderType: 'PICKUP',
          subtotal: 50.00,
          discount: 0,
          tax: 2.50,
          deliveryFee: 0,
          grandTotal: 52.50,
          customerName: 'Order Test',
          customerPhone: '+233201234567',
          customerEmail: 'ordertest@example.com',
        },
      });

      const res = await request(app)
        .delete(`/api/orders/${pendingOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Cleanup
      await prisma.order.delete({ where: { id: pendingOrder.id } });
    });

    it('should reject cancellation of non-pending order', async () => {
      // Create preparing order
      const preparingOrder = await prisma.order.create({
        data: {
          userId,
          orderNumber: 'CRV-2024-TEST004',
          status: 'PREPARING',
          paymentStatus: 'PAID',
          orderType: 'PICKUP',
          subtotal: 50.00,
          discount: 0,
          tax: 2.50,
          deliveryFee: 0,
          grandTotal: 52.50,
          customerName: 'Order Test',
          customerPhone: '+233201234567',
          customerEmail: 'ordertest@example.com',
        },
      });

      const res = await request(app)
        .delete(`/api/orders/${preparingOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);

      // Cleanup
      await prisma.order.delete({ where: { id: preparingOrder.id } });
    });

    it('should allow admin to cancel any order', async () => {
      const res = await request(app)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/orders (admin only)', () => {
    it('should get all orders as admin', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.orders).toBeDefined();
    });

    it('should reject access from customer', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
    });
  });
});
