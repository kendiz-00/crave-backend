import { Request, Response, NextFunction } from 'express';
import { ApiError, HttpStatus } from '@/types';

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      next(new ApiError(HttpStatus.UNAUTHORIZED, 'User not authenticated'));
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      next(new ApiError(HttpStatus.FORBIDDEN, 'Insufficient permissions'));
      return;
    }

    next();
  };
};

export const requireAdmin = authorize('ADMIN', 'OWNER');
export const requireOwner = authorize('OWNER');
