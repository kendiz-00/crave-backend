import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from '@/config';
import logger from '@/utils/logger';
import routes from '@/routes';
import { errorHandler } from '@/middleware/error.middleware';
import { notFoundHandler } from '@/middleware/notFound.middleware';
import { securityHeaders, enforceHTTPS } from '@/middleware/security.middleware';

export const createApp = (): Application => {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());
  app.use(securityHeaders);
  
  // HTTPS enforcement in production
  app.use(enforceHTTPS);

  // CORS configuration - tightened for production
  app.use(
    cors({
      origin: config.isDevelopment
        ? ['http://localhost:3000', 'http://localhost:5173']
        : config.cors.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 86400, // 24 hours
    })
  );

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging with Pino
  app.use(
    pinoHttp({
      logger,
      autoLogging: true,
      customLogLevel: (res, _err) => {
        if (res.statusCode && res.statusCode >= 500) {
          return 'error';
        }
        if (res.statusCode && res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // API routes
  app.use('/', routes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
};
