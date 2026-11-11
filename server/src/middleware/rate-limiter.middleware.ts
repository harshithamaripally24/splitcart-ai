import { Request, Response, NextFunction } from 'express';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function apiRateLimiter(maxRequests = 30, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetAt) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }

    record.count += 1;
    next();
  };
}
