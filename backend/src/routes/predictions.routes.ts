/* filepath: backend/src/routes/predictions.routes.ts */
import { Router } from 'express';
import { predictionsController } from '../controllers/predictions.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public routes (with authentication)
router.get('/gameweek/:gameweek', authenticateToken, predictionsController.getPredictionsByGameweek.bind(predictionsController));
router.get('/user/gameweek/:gameweek', authenticateToken, predictionsController.getUserPredictionsByGameweek.bind(predictionsController));
router.get('/my-predictions', authenticateToken, predictionsController.getUserPredictions.bind(predictionsController));
router.get('/leaderboard', authenticateToken, predictionsController.getLeaderboard.bind(predictionsController));

// Create/Update predictions
router.post('/', authenticateToken, predictionsController.createPrediction.bind(predictionsController));
router.post('/batch', authenticateToken, predictionsController.createBatchPredictions.bind(predictionsController));
router.put('/:id', authenticateToken, predictionsController.updatePrediction.bind(predictionsController));
router.delete('/:id', authenticateToken, predictionsController.deletePrediction.bind(predictionsController));

export default router;