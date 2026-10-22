/**
 * Test SMS Provider
 * For development and testing environments - logs OTP to console instead of sending SMS
 * DO NOT use in production
 */

import { SmsProvider } from './sms-provider.interface';

class TestSmsStore {
  private static instance: TestSmsStore;
  private otpMap: Map<string, string> = new Map();

  static getInstance(): TestSmsStore {
    if (!TestSmsStore.instance) {
      TestSmsStore.instance = new TestSmsStore();
    }
    return TestSmsStore.instance;
  }

  setOtp(phoneNumber: string, otp: string): void {
    this.otpMap.set(phoneNumber, otp);
  }

  getOtp(phoneNumber: string): string | undefined {
    return this.otpMap.get(phoneNumber);
  }

  clear(): void {
    this.otpMap.clear();
  }
}

export class TestSmsProvider implements SmsProvider {
  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    // Redact OTP in console logs for security (use helper method to retrieve during tests)
    const redactedOtp = otp.substring(0, 2) + '****';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📱 TEST SMS PROVIDER - DEVELOPMENT ONLY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Phone Number: ${phoneNumber}`);
    console.log(`OTP Code: ${redactedOtp} (use TestSmsProvider.getTestOtp() to retrieve)`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚠️  THIS PROVIDER IS FOR DEVELOPMENT/TESTING ONLY');
    console.log('⚠️  DO NOT USE IN PRODUCTION UNDER ANY CIRCUMSTANCES');
    console.log('⚠️  Configure SMS_PROVIDER=bulkclix for production use');
    console.log('═══════════════════════════════════════════════════════════════');

    // Store OTP for test retrieval (in-memory only, never logged)
    TestSmsStore.getInstance().setOtp(phoneNumber, otp);
  }

  getProviderName(): string {
    return 'Test Provider (Console Logger)';
  }

  // Test helper method to retrieve the last OTP for a phone number
  static getTestOtp(phoneNumber: string): string | undefined {
    return TestSmsStore.getInstance().getOtp(phoneNumber);
  }

  // Test helper to clear stored OTPs
  static clearTestOtps(): void {
    TestSmsStore.getInstance().clear();
  }
}
