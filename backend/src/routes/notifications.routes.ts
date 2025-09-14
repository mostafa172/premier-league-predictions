import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

// Test email service connection
router.get('/test-connection', notificationsController.testEmailConnection.bind(notificationsController));

// Send test email to current user
router.post('/test-email', notificationsController.sendTestEmail.bind(notificationsController));

// Get notification service status
router.get('/status', notificationsController.getNotificationStatus.bind(notificationsController));

export default router;
