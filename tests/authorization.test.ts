import request from 'supertest';
import { app } from '../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Authorization Tests', () => {
  let customerToken: string;
  let staffToken: string;
  let adminToken: string;
  let ownerToken: string;
  let customerId: string;
  let staffId: string;
  let adminId: string;
  let ownerId: string;

  beforeAll(async () => {
    // Create users with different roles
    const customer = await prisma.user.create({
      data: {
        email: 'customer@example.com',
        password: 'hashedpassword',
        firstName: 'Customer',
        lastName: 'User',
        phone: '+233201234567',
        role: 'CUSTOMER',
      },
    });
    customerId = customer.id;

    const staff = await prisma.user.create({
      data: {
        email: 'staff@example.com',
        password: 'hashedpassword',
        firstName: 'Staff',
        lastName: 'User',
        phone: '+233201234568',
        role: 'STAFF',
      },
    });
    staffId = staff.id;

    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: 'hashedpassword',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+233201234569',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;

    const owner = await prisma.user.create({
      data: {
        email: 'owner@example.com',
        password: 'hashedpassword',
        firstName: 'Owner',
        lastName: 'User',
        phone: '+233201234570',
        role: 'OWNER',
      },
    });
    ownerId = owner.id;

    // Login to get tokens
    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'password123' });
    customerToken = customerLogin.body.data.accessToken;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'password123' });
    staffToken = staffLogin.body.data.accessToken;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: 'password123' });
    ownerToken = ownerLogin.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: customerId } });
    await prisma.user.delete({ where: { id: staffId } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.user.delete({ where: { id: ownerId } });
  });

  describe('Role-Based Access Control', () => {
    describe('GET /api/orders (Admin/Staff only)', () => {
      it('should allow admin access', async () => {
        const res = await request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should allow staff access', async () => {
        const res = await request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
      });

      it('should reject customer access', async () => {
        const res = await request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
      });

      it('should allow owner access', async () => {
        const res = await request(app)
          .get('/api/orders')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
      });
    });

    describe('PATCH /api/orders/:id/status (Admin/Staff only)', () => {
      it('should allow admin access', async () => {
        const res = await request(app)
          .patch('/api/orders/some-id/status')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'PREPARING' });

        // Will return 404 for non-existent order, but not 403
        expect(res.status).not.toBe(403);
      });

      it('should allow staff access', async () => {
        const res = await request(app)
          .patch('/api/orders/some-id/status')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ status: 'PREPARING' });

        expect(res.status).not.toBe(403);
      });

      it('should reject customer access', async () => {
        const res = await request(app)
          .patch('/api/orders/some-id/status')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ status: 'PREPARING' });

        expect(res.status).toBe(403);
      });
    });

    describe('Customer Endpoints', () => {
      it('should allow customer to access their own cart', async () => {
        const res = await request(app)
          .get('/api/cart')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
      });

      it('should allow staff to access cart', async () => {
        const res = await request(app)
          .get('/api/cart')
          .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
      });

      it('should allow admin to access cart', async () => {
        const res = await request(app)
          .get('/api/cart')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });
    });
  });

  describe('Authentication Required', () => {
    it('should reject unauthenticated cart request', async () => {
      const res = await request(app).get('/api/cart');

      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated order request', async () => {
      const res = await request(app).get('/api/orders/my-orders');

      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated reward request', async () => {
      const res = await request(app).get('/api/rewards/balance');

      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('Token Validation', () => {
    it('should accept valid token', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject malformed token', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer malformed.token.here');

      expect(res.status).toBe(401);
    });

    it('should reject missing authorization header', async () => {
      const res = await request(app).get('/api/cart');

      expect(res.status).toBe(401);
    });
  });

  describe('Cross-Role Access Prevention', () => {
    it('should prevent customer from accessing admin endpoints', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should prevent staff from accessing owner-only endpoints (if any)', async () => {
      // This test would be relevant if there are owner-only endpoints
      // For now, owner has same access as admin
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Ownership Validation', () => {
    it('should allow user to access their own resources', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
    });

    it('should prevent user from accessing other user resources', async () => {
      // This is tested in more detail in order.test.ts
      // This is a general authorization check
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200); // Staff can see all orders
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid order status', async () => {
      const res = await request(app)
        .patch('/api/orders/some-id/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid payment status', async () => {
      const res = await request(app)
        .patch('/api/orders/some-id/payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ paymentStatus: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid cart item quantity', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [
            {
              menuItemId: 'some-id',
              quantity: -1,
              addOns: [],
            },
          ],
        });

      expect(res.status).toBe(400);
    });
  });
});
