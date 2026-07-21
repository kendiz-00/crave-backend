import { Request, Response } from 'express';
import { config } from '@/config';

export const apiController = (_req: Request, res: Response): void => {
  res.json({
    version: 'v1',
    environment: config.nodeEnv,
  });
};
