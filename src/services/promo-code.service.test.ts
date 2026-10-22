import { PromoCodeService } from './promo-code.service';
import { PromoCodeStatus, PromoCodeDiscountType } from '@prisma/client';
import prisma from '@/database';

describe('PromoCodeService', () => {
  let promoCodeService: PromoCodeService;
  let testUserId: string;
  let testPromoCodeId: string;

  beforeAll(async () => {
    promoCodeService = new PromoCodeService();

    // Create a test admin user
    const testAdmin = await prisma.user.create({
      data: {
        email: 'admin-test@crave.com',
        phone: '+233500000001',
        password: 'hashedpassword',
        firstName: 'Admin',
        lastName: 'Test',
        role: 'ADMIN',
      },
    });
    testUserId = testAdmin.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.promoCode.deleteMany({
      where: { createdBy: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('createPromoCode', () => {
    it('should create a new promo code successfully', async () => {
      const promoCodeData = {
        code: 'TEST10',
        name: 'Test Discount',
        description: 'Test promo code',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        minSpend: 50,
        maxDiscountAmount: 20,
        usageLimit: 100,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        validFrom: new Date().toISOString(),
        restrictedUserIds: [],
        restrictedEmails: [],
      };

      const promoCode = await promoCodeService.createPromoCode(testUserId, promoCodeData);

      expect(promoCode).toBeDefined();
      expect(promoCode.code).toBe('TEST10');
      expect(promoCode.name).toBe('Test Discount');
      expect(promoCode.discountType).toBe(PromoCodeDiscountType.PERCENTAGE);
      expect(promoCode.discountValue).toBe('10');
      expect(promoCode.status).toBe(PromoCodeStatus.ACTIVE);

      testPromoCodeId = promoCode.id;
    });

    it('should throw error if code already exists', async () => {
      const promoCodeData = {
        code: 'TEST10',
        name: 'Duplicate Test',
        discountType: 'PERCENTAGE' as const,
        discountValue: 15,
        usageLimit: 50,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        restrictedUserIds: [],
        restrictedEmails: [],
      };

      await expect(promoCodeService.createPromoCode(testUserId, promoCodeData)).rejects.toThrow(
        'Promo code already exists'
      );
    });

    it('should throw error if user is not admin', async () => {
      const customerUser = await prisma.user.create({
        data: {
          email: 'customer-test@crave.com',
          phone: '+233500000002',
          password: 'hashedpassword',
          firstName: 'Customer',
          lastName: 'Test',
          role: 'CUSTOMER',
        },
      });

      const promoCodeData = {
        code: 'CUSTOMER20',
        name: 'Customer Promo',
        discountType: 'PERCENTAGE' as const,
        discountValue: 20,
        usageLimit: 50,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        restrictedUserIds: [],
        restrictedEmails: [],
      };

      await expect(promoCodeService.createPromoCode(customerUser.id, promoCodeData)).rejects.toThrow(
        'Only admins can create promo codes'
      );

      await prisma.user.delete({ where: { id: customerUser.id } });
    });
  });

  describe('validatePromoCode', () => {
    // Create a test menu item for cart validation
    let testMenuItemId: string;

    beforeAll(async () => {
      const testCategory = await prisma.category.create({
        data: {
          name: 'Test Category',
          slug: 'test-category',
        },
      });

      const testMenuItem = await prisma.menuItem.create({
        data: {
          name: 'Test Item',
          slug: 'test-item',
          description: 'Test item',
          price: 50,
          imageUrl: 'test.jpg',
          preparationTime: 15,
          categoryId: testCategory.id,
        },
      });

      testMenuItemId = testMenuItem.id;
    });

    afterAll(async () => {
      // Cleanup test menu item
      await prisma.menuItem.delete({
        where: { id: testMenuItemId },
      });
      await prisma.category.deleteMany({
        where: { slug: 'test-category' },
      });
    });

    it('should validate a valid promo code with cart items', async () => {
      const result = await promoCodeService.validatePromoCode({
        code: 'TEST10',
        cartItems: [
          {
            menuItemId: testMenuItemId,
            quantity: 2,
            addOns: [],
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.code).toBe('TEST10');
      expect(result.discountAmount).toBe(10); // 10% of 100 (50 * 2)
    });

    it('should throw error for invalid promo code', async () => {
      await expect(
        promoCodeService.validatePromoCode({
          code: 'INVALID',
          cartItems: [],
        })
      ).rejects.toThrow('Invalid promo code');
    });

    it('should throw error for inactive promo code', async () => {
      // Deactivate the test promo code
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: { status: PromoCodeStatus.INACTIVE },
      });

      await expect(
        promoCodeService.validatePromoCode({
          code: 'TEST10',
          cartItems: [],
        })
      ).rejects.toThrow('Promo code is not active');

      // Reactivate for other tests
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: { status: PromoCodeStatus.ACTIVE },
      });
    });

    it('should throw error for expired promo code', async () => {
      await expect(
        promoCodeService.validatePromoCode({
          code: 'TEST10',
          cartItems: [],
        })
      ).rejects.toThrow('Promo code has expired');
    });

    it('should throw error if minimum spend not met', async () => {
      // Reactivate and update min spend
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: {
          status: PromoCodeStatus.ACTIVE,
          minSpend: 50,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await expect(
        promoCodeService.validatePromoCode({
          code: 'TEST10',
          cartItems: [
            {
              menuItemId: testMenuItemId,
              quantity: 1,
              addOns: [],
            },
          ],
        })
      ).rejects.toThrow('Minimum spend of GH₵50 required');
    });

    it('should apply max discount cap', async () => {
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: {
          minSpend: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await promoCodeService.validatePromoCode({
        code: 'TEST10',
        cartItems: [
          {
            menuItemId: testMenuItemId,
            quantity: 10,
            addOns: [],
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(20); // Max discount cap is 20
    });

    it('should respect user restrictions', async () => {
      const restrictedUserId = '00000000-0000-0000-0000-000000000001';

      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: {
          restrictedUserIds: [restrictedUserId],
        },
      });

      await expect(
        promoCodeService.validatePromoCode(
          {
            code: 'TEST10',
            cartItems: [],
          },
          '00000000-0000-0000-0000-000000000002'
        )
      ).rejects.toThrow('This promo code is not available for your account');

      // Clear restrictions
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: {
          restrictedUserIds: [],
        },
      });
    });

    it('should respect email restrictions', async () => {
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: {
          restrictedEmails: ['allowed@example.com'],
        },
      });

      await expect(
        promoCodeService.validatePromoCode(
          {
            code: 'TEST10',
            cartItems: [],
          },
          undefined,
          'blocked@example.com'
        )
      ).rejects.toThrow('This promo code is not available for your email');

      // Clear restrictions
      await prisma.promoCode.update({
        where: { id: testPromoCodeId },
        data: {
          restrictedEmails: [],
        },
      });
    });
  });

  describe('fixed discount type', () => {
    it('should apply fixed discount correctly', async () => {
      const fixedPromo = await prisma.promoCode.create({
        data: {
          code: 'FIXED20',
          name: 'Fixed Discount Test',
          discountType: PromoCodeDiscountType.FIXED,
          discountValue: 20,
          usageLimit: 50,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdBy: testUserId,
          status: PromoCodeStatus.ACTIVE,
        },
      });

      const result = await promoCodeService.validatePromoCode({
        code: 'FIXED20',
        subtotal: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(20); // Fixed amount

      await prisma.promoCode.delete({ where: { id: fixedPromo.id } });
    });
  });
});
