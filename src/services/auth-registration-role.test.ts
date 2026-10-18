jest.mock('@/database', () => ({
  __esModule: true,
  default: {
    phoneVerification: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '@/database';
import { AuthService } from '@/services/auth.service';
import { registerSchema } from '@/validators/auth.validator';

describe('public registration role assignment', () => {
  const database = prisma as unknown as {
    phoneVerification: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['STAFF', 'ADMIN', 'OWNER'])('always creates a CUSTOMER when the client submits %s', async (role) => {
    const createdUser = {
      id: 'user-id',
      email: null,
      phone: '+233241234567',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'CUSTOMER',
      isActive: true,
      phoneVerified: true,
      createdAt: new Date(),
    };
    const transaction = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      refreshToken: { create: jest.fn().mockResolvedValue({ id: 'refresh-id' }) },
    };
    database.phoneVerification.findFirst.mockResolvedValue({
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    database.user.findUnique.mockResolvedValue(null);
    database.$transaction.mockImplementation((callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction)
    );

    const input = registerSchema.parse({
      email: 'test@example.com',
      phone: '0241234567',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'Customer',
      role,
    });
    await AuthService.register(input);

    expect(input).not.toHaveProperty('role');
    expect(transaction.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'CUSTOMER' }),
    }));
  });
});
