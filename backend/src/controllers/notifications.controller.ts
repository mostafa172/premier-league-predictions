import { Request, Response } from 'express';
import { emailService } from '../services/email.service';
import { notificationScheduler } from '../services/notification.scheduler';

interface AuthenticatedRequest extends Request {
  user?: { id: number; username: string; email: string; isAdmin: boolean };
}

export class NotificationsController {
  // Test email service connection
  public async testEmailConnection(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const isConnected = await emailService.testConnection();
      
      if (isConnected) {
        return res.status(200).json({
          success: true,
          message: 'Email service connection successful'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Email service connection failed'
        });
      }
    } catch (error) {
      console.error('Test email connection error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error testing email connection'
      });
    }
  }

  // Send test email to current user
  public async sendTestEmail(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const success = await notificationScheduler.sendTestReminder(
        req.user.email,
        req.user.username
      );

      if (success) {
        return res.status(200).json({
          success: true,
          message: 'Test email sent successfully'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to send test email'
        });
      }
    } catch (error) {
      console.error('Send test email error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error sending test email'
      });
    }
  }

  // Get notification service status
  public async getNotificationStatus(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const emailConnected = await emailService.testConnection();
      
      return res.status(200).json({
        success: true,
        data: {
          emailService: {
            configured: !!process.env.EMAIL_HOST && !!process.env.EMAIL_USER,
            connected: emailConnected
          },
          scheduler: {
            running: true // The scheduler is always running once initialized
          }
        }
      });
    } catch (error) {
      console.error('Get notification status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting notification status'
      });
    }
  }
}

export const notificationsController = new NotificationsController();
