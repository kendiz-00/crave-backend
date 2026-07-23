import { Request, Response, NextFunction } from 'express';
import { config } from '@/config';

/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.paystack.co https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.paystack.co",
    "frame-src 'self' https://js.paystack.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "block-all-mixed-content",
  ];

  if (config.isDevelopment) {
    cspDirectives.push("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  }

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // HSTS (HTTP Strict Transport Security) - only in production
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP requests to HTTPS in production
 */
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction) => {
  if (config.isProduction && req.protocol === 'http') {
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
    return res.redirect(301, httpsUrl);
  }
  next();
};
