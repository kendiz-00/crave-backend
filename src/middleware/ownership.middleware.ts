import { Request, Response, NextFunction } from 'express';
import prisma from '@/database';
import { ApiError } from '../types/errors';

/**
 * Middleware to validate cart ownership
 * Customers can only access their own carts
 * Admin and staff can access all carts
 */
export const validateCartOwnership = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const cartId = req.params.id || req.params.cartId;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Admin and staff have full access
    if (userRole === 'ADMIN' || userRole === 'STAFF' || userRole === 'OWNER') {
      return next();
    }

    // Customers can only access their own carts
    if (!cartId) {
      // For cart creation, we don't need to validate ownership
      return next();
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      select: { userId: true },
    });

    if (!cart) {
      throw new ApiError(404, 'Cart not found');
    }

    if (cart.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to access this cart');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate order ownership
 * Customers can only access their own orders
 * Admin and staff can access all orders
 */
export const validateOrderOwnership = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const orderId = req.params.id || req.params.orderId;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Admin and staff have full access
    if (userRole === 'ADMIN' || userRole === 'STAFF' || userRole === 'OWNER') {
      return next();
    }

    if (!orderId) {
      throw new ApiError(400, 'Order ID is required');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (order.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to access this order');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate order status for cancellation
 * Customers can only cancel pending orders
 * Admin and staff can cancel any order
 */
export const validateOrderCancellation = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const orderId = req.params.id || req.params.orderId;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Admin and staff can cancel any order
    if (userRole === 'ADMIN' || userRole === 'STAFF' || userRole === 'OWNER') {
      return next();
    }

    if (!orderId) {
      throw new ApiError(400, 'Order ID is required');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, status: true },
    });

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (order.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to cancel this order');
    }

    // Customers can only cancel pending orders
    if (order.status !== 'PENDING') {
      throw new ApiError(400, 'Only pending orders can be cancelled');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate reward code ownership
 * Customers can only use their own reward codes
 */
export const validateRewardCodeOwnership = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const rewardCodeId = req.params.id || req.params.rewardCodeId;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Admin and staff have full access
    if (userRole === 'ADMIN' || userRole === 'STAFF' || userRole === 'OWNER') {
      return next();
    }

    if (!rewardCodeId) {
      // For reward code validation during checkout, we handle it in the service
      return next();
    }

    const rewardCode = await prisma.rewardCode.findUnique({
      where: { id: rewardCodeId },
      select: { userId: true },
    });

    if (!rewardCode) {
      throw new ApiError(404, 'Reward code not found');
    }

    if (rewardCode.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to access this reward code');
    }

    next();
  } catch (error) {
    next(error);
  }
};
