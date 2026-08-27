import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/types/errors';
import { config } from '@/config';
import logger from '@/utils/logger';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    logger.error({
      error: {
        message: 'Validation error',
        issues: err.errors,
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
      },
    });

    res.status(400).json({
      error: {
        message: 'Validation failed',
        issues: err.errors,
      },
    });
    return;
  }

  if (err instanceof ApiError) {
    logger.error({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        isOperational: err.isOperational,
        stack: config.isDevelopment ? err.stack : undefined,
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
      },
    });

    res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(config.isDevelopment && { stack: err.stack }),
      },
    });
    return;
  }

  logger.error({
    error: {
      message: err.message,
      stack: config.isDevelopment ? err.stack : undefined,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
    },
  });

  res.status(500).json({
    error: {
      message: config.isDevelopment ? err.message : 'Internal server error',
      ...(config.isDevelopment && { stack: err.stack }),
    },
  });
};
