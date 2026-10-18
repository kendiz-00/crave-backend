import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'Password123!';
const hashPassword = async (plainPassword: string) => bcrypt.hash(plainPassword, 10);

describe('Phase B2 Security Hardening Tests', () => {
  let app: any;
  let customerToken: string;
  let adminToken: string;
  let customerUser: any;
  let adminUser: any;

  beforeAll(async () => {
    app = createApp();

    // Create a regular customer
    const customerPhone = `+23324${Math.floor(1000000 + Math.random() * 9000000)}`;
    customerUser = await prisma.user.create({
      data: {
        phone: customerPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        password: await hashPassword(TEST_PASSWORD),
        firstName: 'Customer',
        lastName: 'User',
        role: 'CUSTOMER',
      },
    });

    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: customerPhone, password: TEST_PASSWORD });
    customerToken = customerLogin.body.data.tokens.accessToken;

    // Create an admin user
    const adminPhone = `+23324${Math.floor(1000000 + Math.random() * 9000000)}`;
    adminUser = await prisma.user.create({
      data: {
        phone: adminPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        password: await hashPassword(TEST_PASSWORD),
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: adminPhone, password: TEST_PASSWORD });
    adminToken = adminLogin.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    if (customerUser) {
      await prisma.rewardTransaction.deleteMany({ where: { userId: customerUser.id } });
      await prisma.user.delete({ where: { id: customerUser.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.rewardTransaction.deleteMany({ where: { userId: adminUser.id } });
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
  });

  describe('Security: Arbitrary point minting closure', () => {
    it('MUST reject arbitrary point minting from normal customer with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          type: 'EARN',
          points: 10000,
          reason: 'Attempted hack to get free food',
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/insufficient permissions/i);

      // Verify no points were credited
      const userAfter = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(userAfter?.lifetimePointsEarned).toBe(0);

      const txCount = await prisma.rewardTransaction.count({ where: { userId: customerUser.id } });
      expect(txCount).toBe(0);
    });

    it('MUST allow authorized ADMIN to create a transaction via /api/rewards/transactions', async () => {
      const res = await request(app)
        .post('/api/rewards/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'BONUS',
          points: 50,
          reason: 'Legitimate admin customer care bonus',
          referenceId: `admin_bonus_${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newBalance).toBe(50);
    });
  });

  describe('Security: Paystack Webhook Cryptographic Verification with rawPayload', () => {
    const originalSecret = process.env.PAYSTACK_SECRET_KEY;
    const testSecret = 'sk_test_paystack_secret_key_12345';

    beforeAll(() => {
      process.env.PAYSTACK_SECRET_KEY = testSecret;
    });

    afterAll(() => {
      process.env.PAYSTACK_SECRET_KEY = originalSecret;
    });

    it('MUST verify and accept webhook with valid HMAC SHA512 signature on raw payload', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: `test_ref_${Date.now()}`,
          amount: 5000,
          status: 'success',
        },
      };

      const rawString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', testSecret)
        .update(rawString)
        .digest('hex');

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-paystack-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('MUST reject webhook with invalid signature with HTTP 401', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: `fake_ref_${Date.now()}`,
        },
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-paystack-signature', 'invalid_bogus_signature_hash')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid signature/i);
    });

    it('MUST reject webhook with missing signature header with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send({ event: 'charge.success' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/missing signature/i);
    });
  });
});
