import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'Password123!';
const hashPassword = async (plainPassword: string) => bcrypt.hash(plainPassword, 10);

describe('Reward Endpoints (Updated for Phone Verification)', () => {
  let app: any;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = createApp();
    
    const basePhone = `024${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;

    await prisma.user.deleteMany({
      where: {
        phone: { contains: '+233' },
      },
    });

    const user = await prisma.user.create({
      data: {
        phone: basePhone.startsWith('0') ? '+233' + basePhone.substring(1) : basePhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        password: await hashPassword(TEST_PASSWORD),
        firstName: 'Reward',
        lastName: 'Test',
        role: 'CUSTOMER',
      },
    });
    userId = user.id;

    // Create reward code
    await prisma.rewardCode.create({
      data: {
        userId,
        code: 'CRV-2024-REWARD123',
        reward: 'WELCOME',
        status: 'GENERATED',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: user.phone,
        password: TEST_PASSWORD,
      });
    authToken = loginRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.rewardTransaction.deleteMany({ where: { userId } });
    await prisma.rewardCode.deleteMany({ where: { userId } });
    await prisma.rewardCode.deleteMany({ where: { code: 'CRV-2024-OTHER' } });
    await prisma.user.delete({ where: { id: userId } });
  });

  describe('POST /api/rewards/claims - first-order reward lifecycle', () => {
    it('should claim the first-order reward once per user and prevent duplicate claims', async () => {
      const basePhone = `024${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      
      const firstUser = await prisma.user.create({
        data: {
          phone: basePhone.startsWith('0') ? '+233' + basePhone.substring(1) : basePhone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          password: await hashPassword(TEST_PASSWORD),
          firstName: 'First',
          lastName: 'Order',
          role: 'CUSTOMER',
        },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: firstUser.phone,
          password: TEST_PASSWORD,
        });

      const firstToken = loginRes.body.data.tokens.accessToken;

      const firstClaimRes = await request(app)
        .post('/api/rewards/claims')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ rewardId: 'first_order_free_drink' });

      expect(firstClaimRes.status).toBe(201);
      expect(firstClaimRes.body.success).toBe(true);
      expect(firstClaimRes.body.data.rewardId).toBe('first_order_free_drink');
      expect(firstClaimRes.body.data.status).toBe('CLAIMED');

      const secondClaimRes = await request(app)
        .post('/api/rewards/claims')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ rewardId: 'first_order_free_drink' });

      expect(secondClaimRes.status).toBe(201);
      expect(secondClaimRes.body.success).toBe(true);
      expect(secondClaimRes.body.data.id).toBe(firstClaimRes.body.data.id);

      const rewardCount = await prisma.rewardClaim.count({
        where: { userId: firstUser.id, rewardId: 'first_order_free_drink' },
      });

      expect(rewardCount).toBe(1);

      await prisma.user.delete({ where: { id: firstUser.id } });
    });

    it('should reject reward claim for unverified user', async () => {
      const basePhone = `024${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      
      const unverifiedUser = await prisma.user.create({
        data: {
          phone: basePhone.startsWith('0') ? '+233' + basePhone.substring(1) : basePhone,
          phoneVerified: false,
          password: await hashPassword(TEST_PASSWORD),
          firstName: 'Unverified',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: unverifiedUser.phone,
          password: TEST_PASSWORD,
        });

      const unverifiedToken = loginRes.body.data.tokens.accessToken;

      const claimRes = await request(app)
        .post('/api/rewards/claims')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({ rewardId: 'first_order_free_drink' });

      expect(claimRes.status).toBe(403);
      expect(claimRes.body.error?.message).toContain('Phone number must be verified');

      await prisma.user.delete({ where: { id: unverifiedUser.id } });
    });
  });

  describe('GET /api/rewards/balance', () => {
    it('should get reward balance', async () => {
      const res = await request(app)
        .get('/api/rewards/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toBeDefined();
      expect(res.body.data.balance).toBeGreaterThanOrEqual(0);
    });

    it('should return zero balance for new user', async () => {
      const basePhone = `024${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      
      const newUser = await prisma.user.create({
        data: {
          phone: basePhone.startsWith('0') ? '+233' + basePhone.substring(1) : basePhone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          password: await hashPassword(TEST_PASSWORD),
          firstName: 'New',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: newUser.phone,
          password: TEST_PASSWORD,
        });
      const newToken = newLoginRes.body.data.tokens.accessToken;

      const res = await request(app)
        .get('/api/rewards/balance')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(0);

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
          runningBalance: 50,
          reason: 'Test earn',
        },
      });

      await prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'REDEEM',
          points: -10,
          runningBalance: 40,
          reason: 'Test redeem',
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

  describe('Reward Transaction Integrity', () => {
    it('should create earn transaction correctly', async () => {
      const transaction = await prisma.rewardTransaction.create({
        data: {
          userId,
          type: 'EARN',
          points: 100,
          runningBalance: 100,
          reason: 'Order completed',
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
          runningBalance: 90,
          reason: 'Reward code redemption',
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
      expect(res2.body.data.newBalance).toBe(res1.body.data.newBalance + 25);
    });

    it('should handle concurrent reward requests for a new user correctly', async () => {
      // Create new test user
      const basePhone = `024${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      
      const newUser = await prisma.user.create({
        data: {
          phone: basePhone.startsWith('0') ? '+233' + basePhone.substring(1) : basePhone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          password: await hashPassword(TEST_PASSWORD),
          firstName: 'Concurrent',
          lastName: 'User',
          role: 'CUSTOMER',
        },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: newUser.phone,
          password: TEST_PASSWORD,
        });
      const newToken = loginRes.body.data.tokens.accessToken;

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
