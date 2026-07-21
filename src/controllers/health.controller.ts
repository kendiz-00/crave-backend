import { Request, Response } from 'express';
import { DatabaseService } from '@/services/database.service';
import { ApiError, HttpStatus } from '@/types/errors';

export const healthController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    await DatabaseService.verifyConnection();

    const uptime = process.uptime();

    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        status: 'unhealthy',
        database: 'disconnected',
        uptime: `${Math.floor(process.uptime() / 60)}m ${Math.floor(
          process.uptime() % 60
        )}s`,
      });
      return;
    }
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      status: 'unhealthy',
      database: 'disconnected',
      uptime: `${Math.floor(process.uptime() / 60)}m ${Math.floor(
        process.uptime() % 60
      )}s`,
    });
  }
};
