import { Request, Response } from 'express';
import { AuthService } from '@/services';
import { registerSchema, loginSchema, refreshTokenSchema } from '@/validators';
import { asyncHandler } from '@/middleware';
import { HttpStatus } from '@/types';

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);
  const result = await AuthService.register(validatedData);

  res.status(HttpStatus.CREATED).json({
    success: true,
    message: 'User registered successfully',
    data: result,
  });
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = loginSchema.parse(req.body);
  const result = await AuthService.login(validatedData);

  res.status(HttpStatus.OK).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  const validatedData = refreshTokenSchema.parse({ refreshToken });
  const result = await AuthService.logout(validatedData.refreshToken);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
  });
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = refreshTokenSchema.parse(req.body);
  const result = await AuthService.refresh(validatedData);

  res.status(HttpStatus.OK).json({
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  });
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const user = await AuthService.me(userId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: user,
  });
});
