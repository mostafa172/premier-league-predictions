/* filepath: backend/src/middleware/admin.middleware.ts */
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const isAdmin = req.user.isAdmin || req.user.is_admin;
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};