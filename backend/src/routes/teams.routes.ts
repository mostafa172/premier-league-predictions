/* filepath: backend/src/routes/teams.routes.ts */
import { Router } from 'express';
import { teamsController } from '../controllers/teams.controller';

const router = Router();

// Get all teams
router.get('/', teamsController.getAllTeams.bind(teamsController));

// Get team by ID
router.get('/:id', teamsController.getTeamById.bind(teamsController));

export default router;