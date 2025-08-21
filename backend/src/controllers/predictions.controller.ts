/* filepath: backend/src/controllers/predictions.controller.ts */
import { Request, Response } from 'express';
import { Prediction } from '../models/Prediction';
import { Fixture } from '../models/Fixture';
import { User } from '../models/User';
import { fn, col, literal } from 'sequelize';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    isAdmin: boolean;
  };
}

export class PredictionsController {
  // Create or update a prediction
  async createPrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { fixtureId, homeScore, awayScore, isDouble = false } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Validate input
      if (!fixtureId || homeScore === undefined || awayScore === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: fixtureId, homeScore, awayScore'
        });
      }

      // Convert to integers and validate
      const predictedHomeScore = parseInt(homeScore);
      const predictedAwayScore = parseInt(awayScore);

      if (isNaN(predictedHomeScore) || isNaN(predictedAwayScore)) {
        return res.status(400).json({
          success: false,
          message: 'Scores must be valid numbers'
        });
      }

      if (predictedHomeScore < 0 || predictedAwayScore < 0 || 
          predictedHomeScore > 20 || predictedAwayScore > 20) {
        return res.status(400).json({
          success: false,
          message: 'Scores must be between 0 and 20'
        });
      }

      // Check if fixture exists and deadline hasn't passed
      const fixture = await Fixture.findByPk(fixtureId);
      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: 'Fixture not found'
        });
      }

      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: 'Prediction deadline has passed'
        });
      }

      // Check for existing prediction
      const existingPrediction = await Prediction.findOne({
        where: { userId, fixtureId }
      });

      if (existingPrediction) {
        // Update existing prediction
        existingPrediction.predictedHomeScore = predictedHomeScore;
        existingPrediction.predictedAwayScore = predictedAwayScore;
        existingPrediction.isDouble = isDouble;
        await existingPrediction.save();

        res.json({
          success: true,
          message: 'Prediction updated successfully',
          data: existingPrediction
        });
      } else {
        // Create new prediction
        const prediction = await Prediction.create({
          userId,
          fixtureId,
          predictedHomeScore,
          predictedAwayScore,
          isDouble,
          points: 0
        });

        res.json({
          success: true,
          message: 'Prediction created successfully',
          data: prediction
        });
      }
    } catch (error: any) {
      console.error('Create prediction error:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving prediction',
        error: error.message
      });
    }
  }

  // Get all predictions (admin only)
  async getAllPredictions(req: AuthenticatedRequest, res: Response) {
    try {
      const predictions = await Prediction.findAll({
        include: [
          {
            model: User,
            attributes: ['id', 'username', 'email']
          },
          {
            model: Fixture,
            attributes: ['id', 'homeTeam', 'awayTeam', 'matchDate', 'gameweek', 'status']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: predictions
      });
    } catch (error: any) {
      console.error('Get all predictions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching predictions',
        error: error.message
      });
    }
  }

  // Get user's predictions
  async getUserPredictions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const predictions = await Prediction.findAll({
        where: { userId },
        include: [
          {
            model: Fixture,
            attributes: ['id', 'homeTeam', 'awayTeam', 'matchDate', 'gameweek', 'status']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: predictions
      });
    } catch (error: any) {
      console.error('Get user predictions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching predictions',
        error: error.message
      });
    }
  }

  // Get current user's predictions (alias for getUserPredictions)
  async getCurrentUserPredictions(req: AuthenticatedRequest, res: Response) {
    return this.getUserPredictions(req, res);
  }

  // Get user's predictions by gameweek
  async getUserPredictionsByGameweek(req: AuthenticatedRequest, res: Response) {
    try {
      const { gameweek } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const predictions = await Prediction.findAll({
        where: { userId },
        include: [
          {
            model: Fixture,
            where: { gameweek: parseInt(gameweek) },
            attributes: ['id', 'homeTeam', 'awayTeam', 'matchDate', 'gameweek', 'status']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: predictions
      });
    } catch (error: any) {
      console.error('Get user predictions by gameweek error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching predictions',
        error: error.message
      });
    }
  }

  // Get current user's predictions by gameweek (alias)
  async getCurrentUserPredictionsByGameweek(req: AuthenticatedRequest, res: Response) {
    return this.getUserPredictionsByGameweek(req, res);
  }

  // Get leaderboard
  async getLeaderboard(req: AuthenticatedRequest, res: Response) {
    try {
      const results = await Prediction.findAll({
        attributes: [
          'userId',
          [fn('SUM', col('points')), 'totalPoints'],
          [
            fn('COUNT', literal('CASE WHEN points > 0 THEN 1 END')),
            'correctPredictions',
          ],
          [fn('COUNT', col('Prediction.id')), 'totalPredictions'],
        ],
        include: [
          {
            model: User,
            attributes: ['username'],
            where: { isAdmin: false },
          },
          {
            model: Fixture,
            attributes: [],
            where: { status: 'finished' },
          },
        ],
        group: ['userId', 'user.id', 'user.username'],
        order: [[fn('SUM', col('points')), 'DESC']],
        raw: false,
      });

      const leaderboard = results.map((result: any, index: number) => ({
        rank: index + 1,
        userId: result.userId,
        username: result.user.username,
        totalPoints: parseInt(result.dataValues.totalPoints) || 0,
        correctPredictions: parseInt(result.dataValues.correctPredictions) || 0,
        totalPredictions: parseInt(result.dataValues.totalPredictions) || 0,
      }));

      res.json({
        success: true,
        data: leaderboard
      });
    } catch (error: any) {
      console.error('Get leaderboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching leaderboard',
        error: error.message
      });
    }
  }

  // Update prediction
  async updatePrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { homeScore, awayScore, isDouble } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const prediction = await Prediction.findOne({
        where: { id, userId },
        include: [Fixture]
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: 'Prediction not found'
        });
      }

      // Check if deadline has passed
      const fixture = prediction.fixture;
      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: 'Prediction deadline has passed'
        });
      }

      // Update prediction
      prediction.predictedHomeScore = parseInt(homeScore);
      prediction.predictedAwayScore = parseInt(awayScore);
      prediction.isDouble = isDouble || false;
      await prediction.save();

      res.json({
        success: true,
        message: 'Prediction updated successfully',
        data: prediction
      });
    } catch (error: any) {
      console.error('Update prediction error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating prediction',
        error: error.message
      });
    }
  }

  // Delete prediction
  async deletePrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const prediction = await Prediction.findOne({
        where: { id, userId },
        include: [Fixture]
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: 'Prediction not found'
        });
      }

      // Check if deadline has passed
      const fixture = prediction.fixture;
      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: 'Prediction deadline has passed'
        });
      }

      await prediction.destroy();

      res.json({
        success: true,
        message: 'Prediction deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete prediction error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting prediction',
        error: error.message
      });
    }
  }

  // Recalculate all points (admin only)
  async recalculateAllPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const count = await Prediction.recalculateAllPoints();
      
      res.json({
        success: true,
        message: `Points recalculated for ${count} predictions`,
        data: { count }
      });
    } catch (error: any) {
      console.error('Recalculate points error:', error);
      res.status(500).json({
        success: false,
        message: 'Error recalculating points',
        error: error.message
      });
    }
  }

  // Alias for recalculateAllPoints
  async recalculatePoints(req: AuthenticatedRequest, res: Response) {
    return this.recalculateAllPoints(req, res);
  }
}

export const predictionsController = new PredictionsController();