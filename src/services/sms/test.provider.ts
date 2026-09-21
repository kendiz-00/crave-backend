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
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📱 TEST SMS PROVIDER - OTP CODE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Phone Number: ${phoneNumber}`);
    console.log(`OTP Code: ${otp}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⚠️  This is a test provider. No SMS was actually sent.');
    console.log('⚠️  Configure a real SMS provider for production use.');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Store OTP for test retrieval
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
