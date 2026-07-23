import { Request, Response, NextFunction } from 'express';
import { config } from '@/config';

/**
 * Simple in-memory cache for GET requests
 * Cache duration: 5 minutes by default
 */
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Cache Middleware
 * Caches GET responses for specified duration
 */
export const cacheMiddleware = (duration: number = CACHE_DURATION) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching in development
    if (config.isDevelopment) {
      return next();
    }

    const cacheKey = `${req.originalUrl}`;

    // Check if cached response exists
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < duration) {
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = (data: unknown) => {
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return originalJson(data);
    };

    next();
  };
};

/**
 * Clear Cache Middleware
 * Clears cache for specific routes
 */
export const clearCache = (_req: Request, _res: Response, next: NextFunction) => {
  // Clear entire cache on POST, PUT, DELETE, PATCH
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(_req.method)) {
    cache.clear();
  }
  next();
};

/**
 * Clean expired cache entries
 * Run periodically to remove old entries
 */
export const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
};

let cacheCleanupInterval: NodeJS.Timeout | null = null;

// Clean expired cache every 5 minutes
if (!config.isDevelopment) {
  cacheCleanupInterval = setInterval(cleanExpiredCache, 5 * 60 * 1000);
}

/**
 * Clear cache cleanup interval on shutdown
 */
export const stopCacheCleanup = () => {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
  }
};
