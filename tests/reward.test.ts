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
          runningBalance: 90,
          reason: 'Test redeem',
        },
      });

      expect(transaction.points).toBeLessThan(0);
      expect(transaction.type).toBe('REDEEM');

      // Cleanup
      await prisma.rewardTransaction.delete({ where: { id: transaction.id } });
    });
  });

  describe('Phase 4 — Idempotency and Concurrency Tests', () => {
    it('should safely handle duplicate referenceId idempotency', async () => {
      const refId = `achievement_test_${Date.now()}`;

      // First request
      const res1 = await request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'EARN',
          points: 50,
          reason: 'Test achievement',
          referenceId: refId,
        });

      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);
      const balance1 = res1.body.data.newBalance;

      // Second identical request (retry)
      const res2 = await request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'EARN',
          points: 50,
          reason: 'Test achievement retry',
          referenceId: refId,
        });

      expect(res2.status).toBe(201);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.isDuplicate).toBe(true);
      expect(res2.body.data.newBalance).toBe(balance1); // Balance remains unchanged
    });

    it('should allow multiple un-referenced transactions without false duplicate rejection', async () => {
      // Transaction 1 without referenceId
      const res1 = await request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'EARN',
          points: 15,
          reason: 'Unreferenced transaction 1',
        });

      expect(res1.status).toBe(201);

      // Transaction 2 without referenceId (must NOT be rejected as duplicate)
      const res2 = await request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'EARN',
          points: 25,
          reason: 'Unreferenced transaction 2',
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.isDuplicate).toBe(false);
      expect(res2.body.data.newBalance).toBe(res1.body.data.newBalance + 25);
    });

    it('should handle concurrent reward requests for a new user correctly', async () => {
      // Create new test user
      const newUser = await prisma.user.create({
        data: {
          email: `concurrent_${Date.now()}@example.com`,
          password: 'password123',
          firstName: 'Concurrent',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: newUser.email,
          password: 'password123',
        });
      const newToken = loginRes.body.data.accessToken;

      // Launch 2 simultaneous requests
      const reqA = request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          type: 'EARN',
          points: 50,
          reason: 'Concurrent A',
          referenceId: `conc_A_${Date.now()}`,
        });

      const reqB = request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          type: 'EARN',
          points: 50,
          reason: 'Concurrent B',
          referenceId: `conc_B_${Date.now()}`,
        });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      // Verify that final balance equals sum of both transactions (100)
      const finalRes = await request(app)
        .get('/api/rewards')
        .set('Authorization', `Bearer ${newToken}`);

      expect(finalRes.body.data.points).toBe(100);

      // Cleanup
      await prisma.rewardTransaction.deleteMany({ where: { userId: newUser.id } });
      await prisma.user.delete({ where: { id: newUser.id } });
    });
  });
});
