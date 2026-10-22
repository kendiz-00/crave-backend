import { validateEnv } from './env.validator';
import fs from 'node:fs';
import path from 'node:path';

const baseEnv: NodeJS.ProcessEnv = {
  PORT: '4000',
  DATABASE_URL: 'postgresql://user:password@db.internal:5432/crave_db_staging',
  JWT_SECRET: 'staging-secret-value-long-enough-for-validation',
  JWT_REFRESH_SECRET: 'another-staging-secret-long-enough-for-validation',
  NODE_ENV: 'staging',
  PAYMENT_MODE: 'test',
  PUBLIC_API_URL: 'https://crave-backend-staging.onrender.com',
  PAYSTACK_PUBLIC_KEY: 'pk_test_PUBLICKEY123',
  PAYSTACK_SECRET_KEY: 'sk_test_SECRETKEY123',
  SMS_PROVIDER: 'africas_talking',
  AFRICAS_TALKING_USERNAME: 'test-sms-username',
  AFRICAS_TALKING_API_KEY: 'test-sms-api-key-not-a-credential',
  CORS_ALLOWED_ORIGINS: 'https://crave-staging.vercel.app',
  CLIENT_URL: 'https://crave-staging.vercel.app',
};

describe('environment separation validation', () => {
  it('accepts a separately named staging database, staging origins and Paystack test keys', () => {
    expect(validateEnv(baseEnv).PAYMENT_MODE).toBe('test');
  });

  it('rejects production database names from staging', () => {
    expect(() => validateEnv({
      ...baseEnv,
      DATABASE_URL: 'postgresql://user:password@db.internal:5432/crave_db',
    })).toThrow('DATABASE_URL');
  });

  it('rejects live payment credentials or mode from staging', () => {
    expect(() => validateEnv({
      ...baseEnv,
      PAYMENT_MODE: 'live',
      PAYSTACK_PUBLIC_KEY: 'pk_live_PUBLICKEY123',
      PAYSTACK_SECRET_KEY: 'sk_live_SECRETKEY123',
    })).toThrow('PAYMENT_MODE');
  });

  it('rejects placeholder Paystack keys in staging', () => {
    expect(() => validateEnv({
      ...baseEnv,
      PAYSTACK_PUBLIC_KEY: 'pk_test_xxxxxxxxxxxxxxxx',
      PAYSTACK_SECRET_KEY: 'sk_test_xxxxxxxxxxxxxxxx',
    })).toThrow('PAYSTACK_PUBLIC_KEY');
  });

  it('rejects staging configuration without the approved SMS provider credentials', () => {
    expect(() => validateEnv({
      ...baseEnv,
      SMS_PROVIDER: 'test',
      AFRICAS_TALKING_USERNAME: undefined,
      AFRICAS_TALKING_API_KEY: undefined,
    })).toThrow('SMS_PROVIDER');
  });

  it('rejects production origins in staging CORS', () => {
    expect(() => validateEnv({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: 'https://crave-staging.vercel.app,https://craveghana.com',
    })).toThrow('CORS_ALLOWED_ORIGINS');
  });

  it('rejects staging payment mode and database names from production', () => {
    expect(() => validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      PAYMENT_MODE: 'test',
      PUBLIC_API_URL: 'https://crave-backend-oie3.onrender.com',
      DATABASE_URL: 'postgresql://user:password@db.internal:5432/crave_db',
      PAYSTACK_PUBLIC_KEY: 'pk_test_PUBLICKEY123',
      PAYSTACK_SECRET_KEY: 'sk_test_SECRETKEY123',
      CORS_ALLOWED_ORIGINS: 'https://craveghana.com',
      CLIENT_URL: 'https://craveghana.com',
    })).toThrow('PAYMENT_MODE');
  });

  it('accepts the production API host and non-staging frontend origins', () => {
    const productionEnv: NodeJS.ProcessEnv = {
      ...baseEnv,
      NODE_ENV: 'production',
      PAYMENT_MODE: 'live',
      PUBLIC_API_URL: 'https://crave-backend-oie3.onrender.com',
      DATABASE_URL: 'postgresql://user:password@db.internal:5432/crave_db',
      PAYSTACK_PUBLIC_KEY: 'pk_live_PUBLICKEY123',
      PAYSTACK_SECRET_KEY: 'sk_live_SECRETKEY123',
      CORS_ALLOWED_ORIGINS: [
        'https://crave-frontend.vercel.app',
        'https://crave.vercel.app',
        'https://crave.com',
        'https://www.crave.com',
        'https://craveghana.com',
        'https://www.craveghana.com',
      ].join(','),
      CLIENT_URL: 'https://craveghana.com',
    };

    expect(validateEnv(productionEnv).PUBLIC_API_URL).toBe('https://crave-backend-oie3.onrender.com');
  });

  it('rejects staging origins from production CORS configuration', () => {
    expect(() => validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      PAYMENT_MODE: 'live',
      PUBLIC_API_URL: 'https://crave-backend-oie3.onrender.com',
      DATABASE_URL: 'postgresql://user:password@db.internal:5432/crave_db',
      PAYSTACK_PUBLIC_KEY: 'pk_live_PUBLICKEY123',
      PAYSTACK_SECRET_KEY: 'sk_live_SECRETKEY123',
      CORS_ALLOWED_ORIGINS: 'https://craveghana.com,https://crave-staging.vercel.app',
      CLIENT_URL: 'https://craveghana.com',
    })).toThrow('CORS_ALLOWED_ORIGINS');
  });

  it('rejects production configuration without approved SMS provider credentials', () => {
    expect(() => validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      PAYMENT_MODE: 'live',
      PUBLIC_API_URL: 'https://crave-backend-oie3.onrender.com',
      DATABASE_URL: 'postgresql://db.internal:5432/crave_db',
      PAYSTACK_PUBLIC_KEY: 'pk_live_PUBLICKEY123',
      PAYSTACK_SECRET_KEY: 'sk_live_SECRETKEY123',
      SMS_PROVIDER: undefined,
      AFRICAS_TALKING_USERNAME: undefined,
      AFRICAS_TALKING_API_KEY: undefined,
      CORS_ALLOWED_ORIGINS: 'https://craveghana.com',
      CLIENT_URL: 'https://craveghana.com',
    })).toThrow('SMS_PROVIDER');
  });

  it('accepts BulkClix as approved production SMS provider with configured credentials', () => {
    const bulkClixEnv: NodeJS.ProcessEnv = {
      ...baseEnv,
      NODE_ENV: 'production',
      PAYMENT_MODE: 'live',
      PUBLIC_API_URL: 'https://crave-backend-oie3.onrender.com',
      DATABASE_URL: 'postgresql://user:password@db.internal:5432/crave_db',
      PAYSTACK_PUBLIC_KEY: 'pk_live_PUBLICKEY123',
      PAYSTACK_SECRET_KEY: 'sk_live_SECRETKEY123',
      SMS_PROVIDER: 'bulkclix',
      BULKCLIX_API_KEY: 'test-bulkclix-api-key',
      BULKCLIX_SENDER_ID: 'CRAVE',
      AFRICAS_TALKING_USERNAME: undefined,
      AFRICAS_TALKING_API_KEY: undefined,
      CORS_ALLOWED_ORIGINS: 'https://craveghana.com',
      CLIENT_URL: 'https://craveghana.com',
    };

    expect(validateEnv(bulkClixEnv).SMS_PROVIDER).toBe('bulkclix');
  });

  it('keeps production deployment config aligned with the validator', () => {
    const renderConfig = fs.readFileSync(path.resolve(__dirname, '../../render.yaml'), 'utf8');
    const productionExample = fs.readFileSync(path.resolve(__dirname, '../../.env.production.example'), 'utf8');
    const stagingExample = fs.readFileSync(path.resolve(__dirname, '../../.env.staging.example'), 'utf8');
    const corsLine = renderConfig.split(/\r?\n/).find((line) => line.includes('value: https://crave-frontend.vercel.app'));

    expect(renderConfig).toContain('value: https://crave-backend-oie3.onrender.com');
    expect(renderConfig).toContain('key: PUBLIC_API_URL');
    expect(renderConfig).toContain('key: PAYMENT_MODE\n        value: live');
    expect(corsLine).toBeDefined();
    expect(corsLine).not.toContain('staging');
    expect(corsLine).toContain('https://crave.vercel.app');
    expect(corsLine).toContain('https://www.craveghana.com');
    expect(productionExample).toContain('SMS_PROVIDER=bulkclix');
    expect(productionExample).toContain('BULKCLIX_API_KEY=your_bulkclix_api_key');
    expect(productionExample).toContain('BULKCLIX_SENDER_ID=CRAVE');
    expect(stagingExample).toContain('SMS_PROVIDER=africas_talking');
    expect(stagingExample).toContain('AFRICAS_TALKING_USERNAME=your_username');
    expect(stagingExample).toContain('AFRICAS_TALKING_API_KEY=your_api_key');
  });
});
