import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PAYSTACK_PUBLIC_KEY: z.string().startsWith('pk_'),
  PAYSTACK_SECRET_KEY: z.string().startsWith('sk_'),
  PAYSTACK_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  CLIENT_URL: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('100'),
  CACHE_TTL: z.string().transform((val) => parseInt(val, 10)).default('300000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  WHATSAPP_NUMBER: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(
        `Environment validation failed. Missing or invalid variables: ${missingVars}`
      );
    }
    throw error;
  }
}
