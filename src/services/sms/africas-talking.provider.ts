/**
 * Africa's Talking SMS Provider
 * Production SMS provider for Ghana and other African countries
 */

import { SmsProvider } from './sms-provider.interface';

export class AfricasTalkingProvider implements SmsProvider {
  private username: string;
  private apiKey: string;

  constructor() {
    this.username = process.env.AFRICAS_TALKING_USERNAME || '';
    this.apiKey = process.env.AFRICAS_TALKING_API_KEY || '';

    if (!this.username || !this.apiKey) {
      console.warn('Africa\'s Talking credentials not configured. SMS sending will fail.');
    }
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    if (!this.username || !this.apiKey) {
      throw new Error('Africa\'s Talking credentials not configured');
    }

    const message = `Your Crave verification code is ${otp}. Valid for 10 minutes. Do not share this code.`;

    try {
      const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          username: this.username,
          to: phoneNumber,
          message: message,
          from: 'CRAVE', // You can configure a sender ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Africa's Talking API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as any;
      
      if (data.SMSMessageData?.Recipients?.[0]?.status !== 'Success') {
        throw new Error(`SMS delivery failed: ${JSON.stringify(data)}`);
      }

      console.log(`OTP sent successfully to ${phoneNumber} via Africa's Talking`);
    } catch (error) {
      console.error('Error sending OTP via Africa\'s Talking:', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'Africa\'s Talking';
  }
}
