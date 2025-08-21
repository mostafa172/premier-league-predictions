import { Router } from 'express';
import { FixturesController } from '../controllers/fixtures.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const fixturesController = new FixturesController();

// Route to get all fixtures
router.get('/', authenticateToken, fixturesController.getAllFixtures.bind(fixturesController));

// Route to get fixtures by gameweek
router.get('/gameweek/:gameweek', authenticateToken, fixturesController.getFixturesByGameweek.bind(fixturesController));

// Route to get upcoming fixtures
router.get('/upcoming', authenticateToken, fixturesController.getUpcomingFixtures.bind(fixturesController));

// Route to get a specific fixture by ID
router.get('/:id', authenticateToken, fixturesController.getFixtureById.bind(fixturesController));

// Route to create a new fixture (admin only)
router.post('/', authenticateToken, requireAdmin, fixturesController.createFixture.bind(fixturesController));

// Route to update an existing fixture (admin only)
router.put('/:id', authenticateToken, requireAdmin, fixturesController.updateFixture.bind(fixturesController));

// Route to delete a fixture (admin only)
router.delete('/:id', authenticateToken, requireAdmin, fixturesController.deleteFixture.bind(fixturesController));

export default router;