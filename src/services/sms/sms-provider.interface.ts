/**
 * SMS Provider Interface
 * Abstract interface for sending SMS messages via different providers
 */

export interface SmsProvider {
  /**
   * Send an OTP code to a phone number
   * @param phoneNumber - The phone number to send to (in E.164 format, e.g., +233241234567)
   * @param otp - The OTP code to send
   * @returns Promise that resolves when the SMS is sent
   */
  sendOtp(phoneNumber: string, otp: string): Promise<void>;

  /**
   * Get the provider name for logging/debugging
   */
  getProviderName(): string;
}
