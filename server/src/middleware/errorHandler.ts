import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // Safe logging that doesn't leak secrets
  console.error(`[Server Error] ${req.method} ${req.path} failed:`, err?.message || 'Unknown error');

  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  res.status(statusCode).json({
    success: false,
    error: err?.message || 'An internal server error occurred. Please try again.',
    ...(config.isProduction ? {} : { debugInfo: err?.code || undefined }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
  });
}
