import { validateEnv } from '@/validators/env.validator';

const env = validateEnv();

export const config = {
  port: env.PORT,
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
  },
  nodeEnv: env.NODE_ENV,
  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',').map((origin) =>
      origin.trim()
    ),
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  sentry: {
    dsn: env.SENTRY_DSN,
  },
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export type Config = typeof config;
