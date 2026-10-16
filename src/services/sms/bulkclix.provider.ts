/**
 * BulkClix SMS Provider
 * Production SMS provider for Ghana using BulkClix general SMS API
 */

import { SmsProvider } from './sms-provider.interface';

export class BulkClixProvider implements SmsProvider {
  private apiKey: string;
  private senderId: string;
  private baseUrl = 'https://api.bulkclix.com/api/v1';

  constructor() {
    this.apiKey = process.env.BULKCLIX_API_KEY || '';
    this.senderId = process.env.BULKCLIX_SENDER_ID || '';

    // Safe diagnostic logging without exposing actual credentials
    console.log('BulkClix credentials diagnostic:', {
      apiKeyConfigured: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      senderIdConfigured: !!this.senderId,
      senderIdLength: this.senderId.length,
      smsProvider: process.env.SMS_PROVIDER,
      endpoint: `${this.baseUrl}/sms-api/send`
    });

    if (!this.apiKey) {
      console.warn('BulkClix API key not configured. SMS sending will fail.');
    }

    if (!this.senderId) {
      console.warn('BulkClix sender ID not configured. SMS sending will fail.');
    }
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('BulkClix API key not configured');
    }

    if (!this.senderId) {
      throw new Error('BulkClix sender ID not configured');
    }

    const message = `Your Crave verification code is ${otp}. Valid for 10 minutes. Do not share this code.`;

    try {
      const response = await fetch(`${this.baseUrl}/sms-api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          sender_id: this.senderId,
          message: message,
          recipients: [phoneNumber],
        }),
      });

      // Safely handle response - check content type before parsing
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();

      if (!response.ok) {
        // Handle error responses safely
        let errorMessage = `BulkClix API error: HTTP ${response.status}`;

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

        // Provide user-friendly error messages for common BulkClix errors
        if (response.status === 402) {
          errorMessage = 'Insufficient SMS credits. Please add funds to your BulkClix account.';
        } else if (response.status === 422) {
          errorMessage = 'Invalid sender ID. Please check your BULKCLIX_SENDER_ID configuration.';
        } else if (response.status === 403) {
          errorMessage = 'Account blocked or not whitelisted. Please contact BulkClix support.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        }

        throw new Error(errorMessage);
      }

      // Handle success responses safely
      let data: any;
      if (contentType && contentType.includes('application/json')) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Invalid JSON response from BulkClix: ${responseText.substring(0, 200)}`);
        }
      } else {
        // Unexpected non-JSON success response
        throw new Error(`Unexpected response format from BulkClix: ${responseText.substring(0, 200)}`);
      }

      if (!data.data || !data.data.campaignId) {
        throw new Error(`BulkClix response missing campaignId: ${JSON.stringify(data)}`);
      }

      console.log(`OTP sent successfully to ${phoneNumber} via BulkClix (campaignId: ${data.data.campaignId})`);
    } catch (error) {
      console.error('Error sending OTP via BulkClix:', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'BulkClix';
  }
}
