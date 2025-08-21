import { Router } from 'express';
import { PredictionsController } from '../controllers/predictions.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const predictionsController = new PredictionsController();

// Admin routes
router.get('/', authenticateToken, requireAdmin, predictionsController.getAllPredictions.bind(predictionsController));

// User routes
router.get('/user', authenticateToken, predictionsController.getCurrentUserPredictions.bind(predictionsController));

// Get user predictions by gameweek
router.get('/user/gameweek/:gameweek', authenticateToken, predictionsController.getCurrentUserPredictionsByGameweek.bind(predictionsController));

// Create/submit prediction
router.post('/', authenticateToken, predictionsController.createPrediction.bind(predictionsController));

// Update prediction
router.put('/:id', authenticateToken, predictionsController.updatePrediction.bind(predictionsController));

// Delete prediction
router.delete('/:id', authenticateToken, predictionsController.deletePrediction.bind(predictionsController));

// Get leaderboard
router.get('/leaderboard', predictionsController.getLeaderboard.bind(predictionsController));

// Admin: Recalculate points
router.post('/recalculate', authenticateToken, requireAdmin, predictionsController.recalculatePoints.bind(predictionsController));

export default router;