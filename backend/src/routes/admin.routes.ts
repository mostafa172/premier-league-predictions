import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'; // Import from auth.middleware

const router = Router();
const adminController = new AdminController();

// Route to recalculate all points
router.post('/recalculate-points', authenticateToken, requireAdmin, adminController.recalculateAllPoints.bind(adminController));

// Route to update all fixture statuses
router.post('/update-statuses', authenticateToken, requireAdmin, adminController.updateAllFixtureStatuses.bind(adminController));

export default router;