import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/http-errors';

export function globalErrorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error('[SplitCart Server Error]:', err?.message || err);
  res.status(502).json({ error: 'Service temporarily unavailable. Please try again.' });
}
