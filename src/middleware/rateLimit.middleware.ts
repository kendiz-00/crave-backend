import rateLimit from 'express-rate-limit';
import { config } from '@/config';

/**
 * General API Rate Limiter
 * Applied to all API endpoints
 */
export const generalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes by default
  max: config.rateLimit.maxRequests, // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

/**
 * Strict Rate Limiter for Authentication Endpoints
 * More aggressive limiting for login/register to prevent brute force
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    // Rate limit by IP and email for login attempts
    const email = req.body?.email || req.ip;
    return `${req.ip}-${email}`;
  },
});

/**
 * Strict Rate Limiter for Payment Endpoints
 * Prevent payment abuse
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: {
    error: 'Too many payment attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Moderate Rate Limiter for Write Operations
 * For POST, PUT, DELETE requests
 */
export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 write operations per minute
  message: {
    error: 'Too many write operations, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to write operations
    return !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  },
});
