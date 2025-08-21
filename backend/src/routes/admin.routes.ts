/* filepath: backend/src/routes/admin.routes.ts */
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Admin routes - require authentication, admin check is in controller
router.get('/fixtures', authenticateToken, adminController.getAllFixtures.bind(adminController));
router.post('/recalculate-points', authenticateToken, adminController.recalculatePoints.bind(adminController));
router.put('/fixtures/statuses', authenticateToken, adminController.updateAllFixtureStatuses.bind(adminController));

export default router;