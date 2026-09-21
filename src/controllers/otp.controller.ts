import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { OtpService } from '@/services';
import { sendOtpSchema, verifyOtpSchema } from '@/validators';
import { asyncHandler } from '@/middleware';
import { HttpStatus } from '@/types';
import { ApiError } from '@/types/errors';

export const sendOtpController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const validatedData = sendOtpSchema.parse(req.body);
    const result = await OtpService.sendOtp(validatedData.phoneNumber);

    res.status(HttpStatus.OK).json({
      success: true,
      message: result.message,
      data: {
        expiresAt: result.expiresAt,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      throw new ApiError(HttpStatus.BAD_REQUEST, firstError?.message || 'Validation failed');
    }
    throw error;
  }
});

export const verifyOtpController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const validatedData = verifyOtpSchema.parse(req.body);
    const result = await OtpService.verifyOtp(validatedData.phoneNumber, validatedData.otp);

    res.status(HttpStatus.OK).json({
      success: true,
      message: result.message,
      data: {
        verified: result.success,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      throw new ApiError(HttpStatus.BAD_REQUEST, firstError?.message || 'Validation failed');
    }
    throw error;
  }
});
