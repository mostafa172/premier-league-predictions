import { Router } from 'express';
import { PredictionsController } from '../controllers/predictions.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const predictionsController = new PredictionsController();

// Route to get all predictions (admin only)
router.get('/', authenticateToken, requireAdmin, predictionsController.getAllPredictions);

// Route to get current user's predictions
router.get('/user', authenticateToken, predictionsController.getCurrentUserPredictions);

// Route to get current user's predictions by gameweek
router.get('/user/gameweek/:gameweek', authenticateToken, predictionsController.getCurrentUserPredictionsByGameweek);

// Route to create/update a prediction
router.post('/', authenticateToken, predictionsController.createPrediction);

// Route to update a prediction
router.put('/:id', authenticateToken, predictionsController.updatePrediction);

// Route to delete a prediction
router.delete('/:id', authenticateToken, predictionsController.deletePrediction);

// Route to get leaderboard
router.get('/leaderboard', authenticateToken, predictionsController.getLeaderboard);

// Route to recalculate all points (admin only)
router.post('/recalculate', authenticateToken, requireAdmin, predictionsController.recalculatePoints);

export default router;