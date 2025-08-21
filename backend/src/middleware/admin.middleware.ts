/* filepath: backend/src/middleware/admin.middleware.ts */
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    isAdmin: boolean;
    is_admin: boolean;
  };
}

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated (should be handled by authenticateToken middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if user is admin (check both isAdmin and is_admin for compatibility)
    const isAdmin = req.user.isAdmin || req.user.is_admin;
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // User is admin, proceed to next middleware/route
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in admin middleware'
    });
  }
};