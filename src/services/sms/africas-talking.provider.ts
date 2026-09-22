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
          'ApiKey': this.apiKey, // Africa's Talking requires API key in header
        },
        body: new URLSearchParams({
          username: this.username,
          to: phoneNumber,
          message: message,
          from: 'CRAVE', // You can configure a sender ID
        }),
      });

      // Safely handle response - check content type before parsing
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();

      if (!response.ok) {
        // Handle error responses safely
        let errorMessage = `Africa's Talking API error: HTTP ${response.status}`;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(responseText);
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          } catch {
            // If JSON parsing fails, use the raw text
            errorMessage += ` - ${responseText.substring(0, 200)}`;
          }
        } else {
          // Non-JSON error response
          errorMessage += ` - ${responseText.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }

      // Handle success responses safely
      let data: any;
      if (contentType && contentType.includes('application/json')) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Invalid JSON response from Africa's Talking: ${responseText.substring(0, 200)}`);
        }
      } else {
        // Unexpected non-JSON success response
        throw new Error(`Unexpected response format from Africa's Talking: ${responseText.substring(0, 200)}`);
      }
      
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
