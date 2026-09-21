/**
 * OTP Service
 * Handles phone verification, OTP generation, verification, and rate limiting
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import prisma from '@/database';
import { ApiError, HttpStatus } from '@/types/errors';
import { createSmsProvider } from './sms/sms-provider.factory';

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);

const smsProvider = createSmsProvider();

export class OtpService {
  /**
   * Normalize phone number to E.164 format
   * Handles Ghana phone numbers: 024... → +23324...
   */
  static normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If starts with 0 and is 10 digits (Ghana format), convert to +233
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '+233' + cleaned.substring(1);
    }

    // If already in international format, validate and return
    if (cleaned.startsWith('+')) {
      const parsed = parsePhoneNumber(cleaned);
      if (parsed && parsed.isValid()) {
        return parsed.format('E.164');
      }
    }

    // Try to parse as Ghana number if no country code
    const parsed = parsePhoneNumber(cleaned, 'GH');
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }

    throw new ApiError(HttpStatus.BAD_REQUEST, 'Invalid phone number format');
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      return isValidPhoneNumber(normalized);
    } catch {
      return false;
    }
  }

  /**
   * Generate a cryptographically secure OTP
   */
  private static generateOtp(): string {
    const bytes = crypto.randomBytes(Math.ceil(OTP_LENGTH / 2));
    const otp = parseInt(bytes.toString('hex'), 16).toString().slice(0, OTP_LENGTH);
    return otp.padStart(OTP_LENGTH, '0');
  }

  /**
   * Hash OTP for secure storage
   */
  private static async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, SALT_ROUNDS);
  }

  /**
   * Verify OTP against hash
   */
  private static async verifyOtpHash(otp: string, hash: string): Promise<boolean> {
    return bcrypt.compare(otp, hash);
  }

  /**
   * Check rate limit for OTP requests
   */
  private static async checkRateLimit(phoneNumber: string): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - OTP_RESEND_COOLDOWN_SECONDS * 1000);

    // Clean up old rate limit records
    await prisma.otpRateLimit.deleteMany({
      where: {
        windowStart: {
          lt: windowStart,
        },
      },
    });

    // Check for recent requests
    const recentRequest = await prisma.otpRateLimit.findUnique({
      where: {
        phoneNumber_windowStart: {
          phoneNumber,
          windowStart,
        },
      },
    });

    if (recentRequest) {
      const cooldownRemaining = OTP_RESEND_COOLDOWN_SECONDS - Math.floor((now.getTime() - recentRequest.windowStart.getTime()) / 1000);
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        `Please wait ${cooldownRemaining} seconds before requesting another OTP`
      );
    }

    // Create new rate limit record
    await prisma.otpRateLimit.create({
      data: {
        phoneNumber,
        windowStart,
        requestCount: 1,
      },
    });
  }

  /**
   * Send OTP to phone number
   */
  static async sendOtp(phoneNumber: string): Promise<{ message: string; expiresAt: Date }> {
    // Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Check rate limit
    await this.checkRateLimit(normalizedPhone);

    // Generate OTP
    const otp = this.generateOtp();
    const hashedOtp = await this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Clean up expired OTPs for this phone number
    await prisma.phoneVerification.deleteMany({
      where: {
        phoneNumber: normalizedPhone,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Store OTP in database
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: normalizedPhone,
        otp: hashedOtp,
        expiresAt,
        attempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
      },
    });

    // Send OTP via SMS
    try {
      await smsProvider.sendOtp(normalizedPhone, otp);
    } catch (error) {
      // If SMS fails, delete the OTP record to allow retry
      await prisma.phoneVerification.deleteMany({
        where: {
          phoneNumber: normalizedPhone,
          createdAt: {
            gte: new Date(Date.now() - 1000), // Just created
          },
        },
      });
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to send OTP. Please try again.'
      );
    }

    return {
      message: `OTP sent to ${normalizedPhone}`,
      expiresAt,
    };
  }

  /**
   * Verify OTP for phone number
   */
  static async verifyOtp(phoneNumber: string, otp: string): Promise<{ success: boolean; message: string }> {
    // Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Find active OTP record
    const verification = await prisma.phoneVerification.findFirst({
      where: {
        phoneNumber: normalizedPhone,
        expiresAt: {
          gt: new Date(),
        },
        verifiedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verification) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'No valid OTP found. Please request a new OTP.');
    }

    // Check max attempts
    if (verification.attempts >= verification.maxAttempts) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Maximum attempts exceeded. Please request a new OTP.');
    }

    // Increment attempt count
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { attempts: verification.attempts + 1 },
    });

    // Verify OTP
    const isValid = await this.verifyOtpHash(otp, verification.otp);

    if (!isValid) {
      const remainingAttempts = verification.maxAttempts - (verification.attempts + 1);
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Invalid OTP. ${remainingAttempts} attempts remaining.`
      );
    }

    // Mark as verified
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { verifiedAt: new Date() },
    });

    return {
      success: true,
      message: 'Phone number verified successfully',
    };
  }

  /**
   * Check if a phone number has been verified
   */
  static async isPhoneVerified(phoneNumber: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { phoneVerified: true },
    });

    return user?.phoneVerified || false;
  }

  /**
   * Mark phone number as verified for a user
   */
  static async markPhoneVerified(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });
  }

  /**
   * Clean up expired OTP records (should be run periodically)
   */
  static async cleanupExpiredOtps(): Promise<void> {
    const result = await prisma.phoneVerification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`Cleaned up ${result.count} expired OTP records`);
  }
}
