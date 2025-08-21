/* filepath: backend/src/routes/predictions.routes.ts */
import { Router } from 'express';
import { PredictionsController } from '../controllers/predictions.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
const predictionsController = new PredictionsController();

// Admin routes - Fix method name
router.get('/', authenticateToken, requireAdmin, predictionsController.getUserPredictions.bind(predictionsController));

// User routes - Fix method names
router.get('/user', authenticateToken, predictionsController.getUserPredictions.bind(predictionsController));

// Get user predictions by gameweek - Fix method name
router.get('/user/gameweek/:gameweek', authenticateToken, predictionsController.getUserPredictionsByGameweek.bind(predictionsController));

// Create/submit prediction
router.post('/', authenticateToken, predictionsController.createPrediction.bind(predictionsController));

// Update prediction
router.put('/:id', authenticateToken, predictionsController.updatePrediction.bind(predictionsController));

// Delete prediction
router.delete('/:id', authenticateToken, predictionsController.deletePrediction.bind(predictionsController));

// Get leaderboard
router.get('/leaderboard', predictionsController.getLeaderboard.bind(predictionsController));

// Admin: Recalculate points - Add missing method
router.post('/recalculate', authenticateToken, requireAdmin, predictionsController.recalculateAllPoints.bind(predictionsController));

export default router;