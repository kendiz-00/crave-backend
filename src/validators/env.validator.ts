import { z } from 'zod';

function isUsablePaystackKey(
  value: string | undefined,
  prefix: 'pk_test_' | 'sk_test_' | 'pk_live_' | 'sk_live_',
): boolean {
  const suffix = value?.slice(prefix.length) || '';
  return Boolean(
    value?.startsWith(prefix) &&
    /^[A-Za-z0-9]+$/.test(suffix) &&
    !/^(x+|replace|placeholder|example)/i.test(suffix)
  );
}

const envSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32).optional().default('dev-refresh-secret-key-for-development-only-do-not-use-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PAYMENT_MODE: z.enum(['test', 'live']).optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().startsWith('pk_').optional(),
  PAYSTACK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  SMS_PROVIDER: z.enum(['africas_talking', 'africastalking', 'bulkclix', 'bulk_clix', 'test']).optional(),
  AFRICAS_TALKING_USERNAME: z.string().optional(),
  AFRICAS_TALKING_API_KEY: z.string().optional(),
  BULKCLIX_API_KEY: z.string().optional(),
  BULKCLIX_SENDER_ID: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,https://craveghana.com,https://www.craveghana.com,https://crave-frontend.vercel.app'),
  CLIENT_URL: z.string().url().optional().default('https://craveghana.com'),
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
}).superRefine((env, context) => {
  const databaseUrl = new URL(env.DATABASE_URL);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase();
  const apiHost = env.PUBLIC_API_URL ? new URL(env.PUBLIC_API_URL).hostname.toLowerCase() : '';
  const configuredOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  
  const isAfricasTalking = env.SMS_PROVIDER === 'africas_talking' || env.SMS_PROVIDER === 'africastalking';
  const isBulkClix = env.SMS_PROVIDER === 'bulkclix' || env.SMS_PROVIDER === 'bulk_clix';
  const isApprovedSmsProvider = isAfricasTalking || isBulkClix;

  const africasTalkingConfigured = Boolean(
    env.AFRICAS_TALKING_USERNAME?.trim() &&
    env.AFRICAS_TALKING_API_KEY?.trim() &&
    !/^(your_|replace|placeholder|example)/i.test(env.AFRICAS_TALKING_USERNAME.trim()) &&
    !/^(your_|replace|placeholder|example)/i.test(env.AFRICAS_TALKING_API_KEY.trim())
  );

  const bulkClixConfigured = Boolean(
    env.BULKCLIX_API_KEY?.trim() &&
    env.BULKCLIX_SENDER_ID?.trim() &&
    !/^(your_|replace|placeholder|example)/i.test(env.BULKCLIX_API_KEY.trim()) &&
    !/^(your_|replace|placeholder|example)/i.test(env.BULKCLIX_SENDER_ID.trim())
  );

  const smsCredentialsConfigured = (isAfricasTalking && africasTalkingConfigured) ||
    (isBulkClix && bulkClixConfigured);
  const originHosts = configuredOrigins.map((origin) => {
    try {
      const parsedOrigin = new URL(origin);
      if ((env.NODE_ENV === 'staging' || env.NODE_ENV === 'production') &&
          (parsedOrigin.protocol !== 'https:' || parsedOrigin.username || parsedOrigin.password ||
           (parsedOrigin.pathname && parsedOrigin.pathname !== '/') || parsedOrigin.search || parsedOrigin.hash)) {
        throw new Error('Not an HTTPS origin.');
      }
      return parsedOrigin.hostname.toLowerCase();
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'Each CORS origin must be a valid URL.',
      });
      return '';
    }
  });

  if (env.NODE_ENV === 'staging') {
    if (!env.PUBLIC_API_URL || new URL(env.PUBLIC_API_URL).protocol !== 'https:' ||
        !apiHost.includes('staging') || !apiHost.endsWith('.onrender.com')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PUBLIC_API_URL'],
        message: 'Staging PUBLIC_API_URL must identify the dedicated staging Render service.',
      });
    }
    if (!databaseName.includes('staging') && !databaseName.includes('test')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Staging DATABASE_URL must target a database explicitly named staging or test.',
      });
    }
    if (env.PAYMENT_MODE !== 'test') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_MODE'],
        message: 'Staging requires PAYMENT_MODE=test.',
      });
    }
    if (!isUsablePaystackKey(env.PAYSTACK_PUBLIC_KEY, 'pk_test_') ||
        !isUsablePaystackKey(env.PAYSTACK_SECRET_KEY, 'sk_test_')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYSTACK_PUBLIC_KEY'],
        message: 'Staging requires valid Paystack test public and secret keys.',
      });
    }
    if (!isApprovedSmsProvider || !smsCredentialsConfigured) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER'],
        message: "Staging requires an approved SMS provider (BulkClix or Africa's Talking) and configured credentials.",
      });
    }
    if (new URL(env.CLIENT_URL).protocol !== 'https:' ||
        !env.CLIENT_URL.toLowerCase().includes('staging') ||
        originHosts.length === 0 ||
        originHosts.some((host) => !host.includes('staging'))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'Staging client and CORS origins must use staging-only hosts.',
      });
    }
  }

  if (env.NODE_ENV === 'production') {
    if (apiHost !== 'crave-backend-oie3.onrender.com') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PUBLIC_API_URL'],
        message: 'Production PUBLIC_API_URL must match the approved production backend.',
      });
    }
    if (databaseName.includes('staging') || databaseName.includes('test')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL cannot target a staging or test database.',
      });
    }
    if ((env.PAYMENT_MODE || 'live') !== 'live') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_MODE'],
        message: 'Production requires PAYMENT_MODE=live.',
      });
    }
    if (!isUsablePaystackKey(env.PAYSTACK_PUBLIC_KEY, 'pk_live_') ||
        !isUsablePaystackKey(env.PAYSTACK_SECRET_KEY, 'sk_live_')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYSTACK_PUBLIC_KEY'],
        message: 'Production requires valid Paystack live public and secret keys.',
      });
    }
    if (!isApprovedSmsProvider || !smsCredentialsConfigured) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER'],
        message: "Production requires an approved SMS provider (BulkClix or Africa's Talking) and configured credentials.",
      });
    }
    if (new URL(env.CLIENT_URL).protocol !== 'https:' ||
        env.CLIENT_URL.toLowerCase().includes('staging') ||
        originHosts.some((host) => host.includes('staging'))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'Production client and CORS origins cannot include staging hosts.',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(source: NodeJS.ProcessEnv = process.env): Env {
  try {
    return envSchema.parse(source);
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
