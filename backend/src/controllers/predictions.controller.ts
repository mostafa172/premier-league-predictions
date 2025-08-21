import { Request, Response } from 'express';
import { Prediction } from '../models/Prediction';
import { Fixture } from '../models/Fixture';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { PredictionCreationAttributes, PredictionUpdateAttributes } from '../interfaces/prediction.interface';
import { Op } from 'sequelize';

export class PredictionsController {
  // Create or update prediction
  public async createPrediction(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.id;
      const { fixtureId, homeScore, awayScore, isDouble } = req.body;

      // Validate input
      if (!fixtureId || homeScore === undefined || awayScore === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: fixtureId, homeScore, awayScore'
        });
      }

      // Check if fixture exists and is still open for predictions
      const fixture = await Fixture.findByPk(fixtureId);
      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: 'Fixture not found'
        });
      }

      if (new Date() > fixture.deadline) {
        return res.status(400).json({
          success: false,
          message: 'Prediction deadline has passed'
        });
      }

      // Check if prediction already exists
      let prediction = await Prediction.findOne({
        where: {
          userId,
          fixtureId
        }
      });

      let created = false;
      if (prediction) {
        // Update existing prediction
        const updateData: PredictionUpdateAttributes = {
          predictedHomeScore: parseInt(homeScore),
          predictedAwayScore: parseInt(awayScore),
          isDouble: Boolean(isDouble)
        };
        
        await prediction.update(updateData);
      } else {
        // Create new prediction with proper typing
        const creationData: PredictionCreationAttributes = {
          userId,
          fixtureId: parseInt(fixtureId),
          predictedHomeScore: parseInt(homeScore),
          predictedAwayScore: parseInt(awayScore),
          isDouble: Boolean(isDouble),
          points: 0
        };
        
        prediction = await Prediction.create(creationData);
        created = true;
      }

      return res.status(created ? 201 : 200).json({
        success: true,
        message: created ? 'Prediction created successfully' : 'Prediction updated successfully',
        data: prediction
      });
    } catch (error) {
      console.error('Prediction creation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error saving prediction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get all predictions (admin only)
  public async getAllPredictions(req: Request, res: Response): Promise<Response> {
    try {
      const predictions = await Prediction.findAll({
        include: [
          {
            model: User,
            attributes: ['id', 'username']
          },
          {
            model: Fixture,
            attributes: ['id', 'homeTeam', 'awayTeam', 'matchDate', 'gameweek']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        data: predictions
      });
    } catch (error) {
      console.error('Get all predictions error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching all predictions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get current user's predictions
  public async getCurrentUserPredictions(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.id;

      const predictions = await Prediction.findAll({
        where: { userId },
        include: [{
          model: Fixture,
          attributes: ['id', 'homeTeam', 'awayTeam', 'matchDate', 'gameweek', 'status', 'homeScore', 'awayScore']
        }],
        order: [[{ model: Fixture, as: 'fixture' }, 'matchDate', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        data: predictions
      });
    } catch (error) {
      console.error('Get user predictions error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching user predictions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get current user's predictions by gameweek
  public async getCurrentUserPredictionsByGameweek(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.id;
      const { gameweek } = req.params;

      const predictions = await Prediction.findAll({
        where: { userId },
        include: [{
          model: Fixture,
          where: { gameweek: parseInt(gameweek) },
          required: true
        }],
        order: [[{ model: Fixture, as: 'fixture' }, 'matchDate', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        data: predictions
      });
    } catch (error) {
      console.error('Get user predictions by gameweek error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching user predictions by gameweek',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Alternative method name for compatibility
  public async getUserPredictionsByGameweek(req: AuthRequest, res: Response): Promise<Response> {
    return this.getCurrentUserPredictionsByGameweek(req, res);
  }

  // Update prediction
  public async updatePrediction(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { homeScore, awayScore, isDouble } = req.body;

      // Find the prediction
      const prediction = await Prediction.findOne({
        where: { id: parseInt(id), userId },
        include: [{ model: Fixture }]
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: 'Prediction not found'
        });
      }

      // Check if deadline has passed
      if (new Date() > prediction.fixture.deadline) {
        return res.status(400).json({
          success: false,
          message: 'Prediction deadline has passed'
        });
      }

      // Update the prediction with proper typing
      const updateData: PredictionUpdateAttributes = {};
      if (homeScore !== undefined) updateData.predictedHomeScore = parseInt(homeScore);
      if (awayScore !== undefined) updateData.predictedAwayScore = parseInt(awayScore);
      if (isDouble !== undefined) updateData.isDouble = Boolean(isDouble);

      await prediction.update(updateData);

      return res.status(200).json({
        success: true,
        message: 'Prediction updated successfully',
        data: prediction
      });
    } catch (error) {
      console.error('Update prediction error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating prediction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Delete prediction
  public async deletePrediction(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Find the prediction
      const prediction = await Prediction.findOne({
        where: { id: parseInt(id), userId },
        include: [{ model: Fixture }]
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: 'Prediction not found'
        });
      }

      // Check if deadline has passed
      if (new Date() > prediction.fixture.deadline) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete prediction after deadline'
        });
      }

      // Delete the prediction
      await prediction.destroy();

      return res.status(200).json({
        success: true,
        message: 'Prediction deleted successfully'
      });
    } catch (error) {
      console.error('Delete prediction error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting prediction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get leaderboard
  public async getLeaderboard(req: Request, res: Response): Promise<Response> {
    try {
      const leaderboard = await Prediction.getLeaderboard();
      return res.status(200).json({
        success: true,
        data: leaderboard
      });
    } catch (error) {
      console.error('Get leaderboard error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching leaderboard',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Recalculate points (admin only)
  public async recalculatePoints(req: Request, res: Response): Promise<Response> {
    try {
      const count = await Prediction.recalculateAllPoints();
      return res.status(200).json({
        success: true,
        message: `Points recalculated for ${count} predictions`
      });
    } catch (error) {
      console.error('Recalculate points error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error recalculating points',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}