import { healthCheck } from '@/database';
import { ApiError, HttpStatus } from '@/types/errors';

export class DatabaseService {
  static async checkHealth(): Promise<boolean> {
    return await healthCheck();
  }

  static async verifyConnection(): Promise<void> {
    const isConnected = await healthCheck();
    if (!isConnected) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Database connection failed'
      );
    }
  }
}
