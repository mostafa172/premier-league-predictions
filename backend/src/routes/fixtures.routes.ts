import { Router } from 'express';
import { FixturesController } from '../controllers/fixtures.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const fixturesController = new FixturesController();

// Route to get all fixtures
router.get('/', authenticateToken, fixturesController.getAllFixtures);

// Route to get fixtures by gameweek
router.get('/gameweek/:gameweek', authenticateToken, fixturesController.getFixturesByGameweek);

// Route to get upcoming fixtures
router.get('/upcoming', authenticateToken, fixturesController.getUpcomingFixtures);

// Route to get a specific fixture by ID
router.get('/:id', authenticateToken, fixturesController.getFixtureById);

// Route to create a new fixture (admin only)
router.post('/', authenticateToken, requireAdmin, fixturesController.createFixture);

// Route to update an existing fixture (admin only)
router.put('/:id', authenticateToken, requireAdmin, fixturesController.updateFixture);

// Route to delete a fixture (admin only)
router.delete('/:id', authenticateToken, requireAdmin, fixturesController.deleteFixture);

export default router;