/* filepath: backend/src/routes/fixtures.routes.ts */
import { Router } from 'express';
import { fixturesController } from '../controllers/fixtures.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

// Public routes (with authentication)
router.get('/', authenticateToken, fixturesController.getAllFixtures.bind(fixturesController));
router.get('/gameweek/:gameweek', authenticateToken, fixturesController.getFixturesByGameweek.bind(fixturesController));
router.get('/upcoming', authenticateToken, fixturesController.getUpcomingFixtures.bind(fixturesController));
router.get('/:id', authenticateToken, fixturesController.getFixtureById.bind(fixturesController));
router.get('/gameweeks/closest', fixturesController.getClosestGameweek.bind(fixturesController));

// Admin routes
router.post('/', authenticateToken, requireAdmin, fixturesController.createFixture.bind(fixturesController));
router.put('/:id', authenticateToken, requireAdmin, fixturesController.updateFixture.bind(fixturesController));
router.delete('/:id', authenticateToken, requireAdmin, fixturesController.deleteFixture.bind(fixturesController));

export default router;