import { Router } from 'express';
import {
  registerController,
  loginController,
  logoutController,
  refreshController,
  meController,
} from '@/controllers';
import { authenticate, authRateLimiter } from '@/middleware';

const router = Router();

// POST /api/auth/register - Register a new user
router.post('/register', authRateLimiter, registerController);

// POST /api/auth/login - Login user
router.post('/login', authRateLimiter, loginController);

// POST /api/auth/logout - Logout user
router.post('/logout', logoutController);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', refreshController);

// GET /api/auth/me - Get current user (protected)
router.get('/me', authenticate, meController);

export default router;
