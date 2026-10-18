import { validateEnv } from '@/validators/env.validator';

const env = validateEnv();

const defaultAllowedOrigins = env.NODE_ENV === 'production'
  ? [
      'https://craveghana.com',
      'https://www.craveghana.com',
      'https://crave-frontend.vercel.app',
    ]
  : env.NODE_ENV === 'staging'
    ? []
    : ['http://localhost:3000', 'http://localhost:5173'];

const configuredOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  port: env.PORT,
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
  },
  nodeEnv: env.NODE_ENV,
  paymentMode: env.PAYMENT_MODE || (env.NODE_ENV === 'production' ? 'live' : undefined),
  publicApiUrl: env.PUBLIC_API_URL,
  cors: {
    allowedOrigins: Array.from(
      new Set([...defaultAllowedOrigins, ...configuredOrigins])
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
