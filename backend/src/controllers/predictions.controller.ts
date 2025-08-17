import { Request, Response } from 'express';
import { Prediction } from '../models/Prediction';
import { AuthRequest } from '../middleware/auth.middleware';

export class PredictionsController {
    public async createPrediction(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const userId = req.user.id;
            const { fixtureId, homeScore, awayScore, isDouble } = req.body;
            
            const predictionData = {
                userId,
                fixtureId,
                homeScore,
                awayScore,
                isDouble: isDouble || false
            };
            
            const prediction = await Prediction.createOrUpdate(predictionData);
            return res.status(201).json({
                success: true,
                message: 'Prediction saved successfully',
                data: prediction
            });
        } catch (error) {
            console.error('Prediction creation error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error saving prediction', 
                error 
            });
        }
    }

    public async getCurrentUserPredictionsByGameweek(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const userId = req.user.id;
            const { gameweek } = req.params;
            const predictions = await Prediction.findByUserIdAndGameweek(userId, parseInt(gameweek));
            return res.status(200).json({
                success: true,
                data: predictions
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching user predictions', 
                error 
            });
        }
    }

    public async getCurrentUserPredictions(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const userId = req.user.id;
            const predictions = await Prediction.findByUserId(userId);
            return res.status(200).json({
                success: true,
                data: predictions
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching user predictions', 
                error 
            });
        }
    }

    public async recalculatePoints(req: Request, res: Response): Promise<Response> {
        try {
            await Prediction.recalculateAllPoints();
            return res.status(200).json({
                success: true,
                message: 'Points recalculated successfully'
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error recalculating points', 
                error 
            });
        }
    }

    public async getLeaderboard(req: Request, res: Response): Promise<Response> {
        try {
            const leaderboard = await Prediction.getLeaderboard();
            return res.status(200).json({
                success: true,
                data: leaderboard
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching leaderboard', 
                error 
            });
        }
    }

    // Keep existing methods...
    public async getAllPredictions(req: Request, res: Response): Promise<Response> {
        try {
            const predictions = await Prediction.findAll();
            return res.status(200).json({
                success: true,
                data: predictions
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching predictions', 
                error 
            });
        }
    }

    public async updatePrediction(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        try {
            const updatedPrediction = await Prediction.update(req.body, { where: { id: parseInt(id) } });
            return res.status(200).json({
                success: true,
                message: 'Prediction updated successfully',
                data: updatedPrediction
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error updating prediction', 
                error 
            });
        }
    }

    public async deletePrediction(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        try {
            await Prediction.destroy({ where: { id: parseInt(id) } });
            return res.status(200).json({
                success: true,
                message: 'Prediction deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error deleting prediction', 
                error 
            });
        }
    }
}