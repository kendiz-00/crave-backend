/**
 * SMS Provider Factory
 * Creates the appropriate SMS provider based on environment configuration
 */

import { SmsProvider } from './sms-provider.interface';
import { AfricasTalkingProvider } from './africas-talking.provider';
import { TestSmsProvider } from './test.provider';

export function createSmsProvider(): SmsProvider {
  const providerType = process.env.SMS_PROVIDER;

  // If SMS_PROVIDER is not configured
  if (!providerType) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS_PROVIDER environment variable must be set in production');
    }
    console.warn('SMS_PROVIDER not configured, defaulting to test provider for development');
    console.log('Initializing test SMS provider (console logger)');
    return new TestSmsProvider();
  }

  switch (providerType.toLowerCase()) {
    case 'africas_talking':
    case 'africastalking':
      console.log('Initializing Africa\'s Talking SMS provider');
      return new AfricasTalkingProvider();

    case 'test':
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  WARNING: Using test SMS provider in production environment!');
        console.warn('⚠️  This will log OTPs to console instead of sending real SMS.');
        console.warn('⚠️  Configure SMS_PROVIDER=africas_talking for production use.');
      }
      console.log('Initializing test SMS provider (console logger)');
      return new TestSmsProvider();

    default:
      throw new Error(`Unknown SMS provider: ${providerType}. Supported providers: africas_talking, test`);
  }
}
