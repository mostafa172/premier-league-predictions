/* filepath: backend/src/middleware/auth.middleware.ts */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Make sure this interface is exported and consistent
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    isAdmin: boolean;
    is_admin?: boolean; // Support both field names for compatibility
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  });
};