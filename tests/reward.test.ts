import request from 'supertest';
import { app } from '../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Reward Endpoints', () => {
  let authToken: string;
  let userId: string;
  let rewardCodeId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'rewardtest@example.com',
        password: 'hashedpassword',
        firstName: 'Reward',
        lastName: 'Test',
        phone: '+233201234567',
        role: 'CUSTOMER',
      },
    });
    userId = user.id;

    // Create reward code
    const rewardCode = await prisma.rewardCode.create({
      data: {
        userId,
        code: 'CRV-2024-REWARD123',
        status: 'GENERATED',
        points: 10,
        discountValue: 10.00,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    rewardCodeId = rewardCode.id;

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'rewardtest@example.com',
        password: 'password123',
      });
    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.rewardTransaction.deleteMany({ where: { userId } });
    await prisma.rewardCode.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  describe('GET /api/rewards/balance', () => {
    it('should get reward balance', async () => {
      const res = await request(app)
        .get('/api/rewards/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.balance).toBeDefined();
      expect(res.body.balance.userId).toBe(userId);
    });

    it('should return zero balance for new user', async () => {
      const newUser = await prisma.user.create({
        data: {
          email: 'newuser@example.com',
          password: 'hashed',
          firstName: 'New',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
        });
      const newToken = newLoginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/rewards/balance')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balance.availablePoints).toBe(0);

      // Cleanup
      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/rewards/balance');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/rewards/history', () => {
    it('should get reward history', async () => {
      // Create some transactions
      await prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'EARN',
          points: 50,
          description: 'Test earn',
        },
      });

      await prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'REDEEM',
          points: -10,
          description: 'Test redeem',
        },
      });

      const res = await request(app)
        .get('/api/rewards/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.transactions).toBeDefined();
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/rewards/history?type=EARN')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.transactions).toBeDefined();
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/rewards/history');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/rewards/validate', () => {
    it('should validate valid reward code', async () => {
      const res = await request(app)
        .post('/api/rewards/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'CRV-2024-REWARD123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.rewardCode).toBeDefined();
    });

    it('should reject invalid reward code', async () => {
      const res = await request(app)
        .post('/api/rewards/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'INVALID-CODE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(false);
    });

    it('should reject expired reward code', async () => {
      const expiredCode = await prisma.rewardCode.create({
        data: {
          userId,
          code: 'CRV-2024-EXPIRED',
          status: 'GENERATED',
          points: 10,
          discountValue: 10.00,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/rewards/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'CRV-2024-EXPIRED' });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toContain('expired');

      // Cleanup
      await prisma.rewardCode.delete({ where: { id: expiredCode.id } });
    });

    it('should reject reward code from another user', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'otherreward@example.com',
          password: 'hashed',
          firstName: 'Other',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

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
        .post('/api/rewards/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'CRV-2024-OTHER' });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toContain('permission');

      // Cleanup
      await prisma.rewardCode.delete({ where: { id: otherCode.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should reject already redeemed code', async () => {
      const redeemedCode = await prisma.rewardCode.create({
        data: {
          userId,
          code: 'CRV-2024-REDEEMED',
          status: 'REDEEMED',
          points: 10,
          discountValue: 10.00,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/rewards/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'CRV-2024-REDEEMED' });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);

      // Cleanup
      await prisma.rewardCode.delete({ where: { id: redeemedCode.id } });
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/rewards/validate')
        .send({ code: 'CRV-2024-REWARD123' });

      expect(res.status).toBe(401);
    });
  });

  describe('Reward Transaction Integrity', () => {
    it('should create earn transaction correctly', async () => {
      const transaction = await prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'EARN',
          points: 100,
          description: 'Order completed',
        },
      });

      expect(transaction.points).toBeGreaterThan(0);
      expect(transaction.type).toBe('EARN');

      // Cleanup
      await prisma.rewardTransaction.delete({ where: { id: transaction.id } });
    });

    it('should create redeem transaction correctly', async () => {
      const transaction = await prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'REDEEM',
          points: -10,
          description: 'Reward code redemption',
        },
      });

      expect(transaction.points).toBeLessThan(0);
      expect(transaction.type).toBe('REDEEM');

      // Cleanup
      await prisma.rewardTransaction.delete({ where: { id: transaction.id } });
    });
  });
});
