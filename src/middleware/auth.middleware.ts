import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/utils';
import { ApiError, HttpStatus } from '@/types';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const payload = verifyAccessToken(token);

    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid or expired token'));
    }
  }
};
