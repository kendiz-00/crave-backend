import { Request, Response } from 'express';

export const rootController = (_req: Request, res: Response): void => {
  res.json({
    service: 'CRAVE Platform API',
    status: 'running',
  });
};
