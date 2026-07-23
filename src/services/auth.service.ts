import bcrypt from 'bcrypt';
import prisma from '@/database';
import { generateAuthTokens, verifyRefreshToken, type TokenPayload } from '@/utils';
import { ApiError, HttpStatus } from '@/types';
import type { RegisterInput, LoginInput, RefreshTokenInput } from '@/validators';

const SALT_ROUNDS = 10;

export class AuthService {
  // Register a new user
  static async register(data: RegisterInput) {
    const { email, phone, password, firstName, lastName, role } = data;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new ApiError(HttpStatus.CONFLICT, 'Email already registered');
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      });

      if (existingPhone) {
        throw new ApiError(HttpStatus.CONFLICT, 'Phone number already registered');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user and refresh token in transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone,
          password: hashedPassword,
          firstName,
          lastName,
          role: role || 'CUSTOMER',
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Generate tokens
      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = generateAuthTokens(payload);

      // Store refresh token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt,
        },
      });

      return { user, tokens };
    });

    return result;
  }

  // Login user (email or phone)
  static async login(data: LoginInput) {
    const { identifier, password } = data;

    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid credentials');
    }

    // Generate tokens and store refresh token in transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = generateAuthTokens(payload);

      // Store refresh token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt,
        },
      });

      // Return user without password
      const { password: _password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        tokens,
      };
    });

    return result;
  }

  // Logout user (revoke refresh token)
  static async logout(refreshToken: string) {
    const token = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!token) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Refresh token not found');
    }

    // Revoke token
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  // Refresh access token
  static async refresh(data: RefreshTokenInput) {
    const { refreshToken } = data;

    // Verify refresh token
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    // Check if token exists in database and is not revoked
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Refresh token not found');
    }

    if (tokenRecord.revokedAt) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Refresh token has been revoked');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Refresh token has expired');
    }

    if (!tokenRecord.user.isActive) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'Account is deactivated');
    }

    // Generate new tokens
    const tokens = generateAuthTokens({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
    });

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Store new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId: tokenRecord.user.id,
        token: tokens.refreshToken,
        expiresAt,
      },
    });

    return {
      tokens,
    };
  }

  // Get current user
  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
      },
    });

    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'User not found');
    }

    return user;
  }
}
