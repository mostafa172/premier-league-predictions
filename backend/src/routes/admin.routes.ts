/* filepath: backend/src/routes/admin.routes.ts */
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

// Admin routes - require authentication AND admin privileges
router.get('/fixtures', authenticateToken, requireAdmin, adminController.getAllFixtures.bind(adminController));
router.get('/users', authenticateToken, requireAdmin, adminController.getUsers.bind(adminController));
router.get('/stats', authenticateToken, requireAdmin, adminController.getSystemStats.bind(adminController));

router.post('/recalculate-points', authenticateToken, requireAdmin, adminController.recalculatePoints.bind(adminController));
router.put('/fixtures/statuses', authenticateToken, requireAdmin, adminController.updateAllFixtureStatuses.bind(adminController));
router.put('/fixtures/:fixtureId/result', authenticateToken, requireAdmin, adminController.updateFixtureResult.bind(adminController));

router.delete('/users/:userId', authenticateToken, requireAdmin, adminController.deleteUser.bind(adminController));
router.put('/users/:userId/promote', authenticateToken, requireAdmin, adminController.promoteUser.bind(adminController));

export default router;