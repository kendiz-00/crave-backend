import { Router } from 'express';
import { sendOtpController, verifyOtpController } from '../controllers';
import { authRateLimiter } from '../middleware';

const router = Router();

// POST /api/auth/phone/send-otp - Send OTP to phone number
router.post('/send-otp', authRateLimiter, sendOtpController);

// POST /api/auth/phone/verify-otp - Verify OTP for phone number
router.post('/verify-otp', authRateLimiter, verifyOtpController);

export default router;
