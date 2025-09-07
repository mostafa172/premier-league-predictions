import { Router } from 'express';
import { leaguesController } from '../controllers/leagues.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// League CRUD operations
router.post('/', leaguesController.createLeague.bind(leaguesController));
router.get('/', leaguesController.getAllLeagues.bind(leaguesController));
router.get('/my-leagues', leaguesController.getUserLeagues.bind(leaguesController));
router.get('/:leagueId', leaguesController.getLeagueDetails.bind(leaguesController));

// League membership operations
router.post('/join', leaguesController.joinLeague.bind(leaguesController));
router.delete('/:leagueId/leave', leaguesController.leaveLeague.bind(leaguesController));

// League management operations
router.delete('/:leagueId', leaguesController.deleteLeague.bind(leaguesController));

export default router;
