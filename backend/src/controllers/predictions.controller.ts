/* filepath: backend/src/controllers/predictions.controller.ts */
import { Request, Response } from "express";
import { Prediction } from "../models/Prediction";
import { Fixture } from "../models/Fixture";
import { User } from "../models/User";
import { fn, col, literal } from "sequelize";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    isAdmin: boolean;
  };
}

interface LeaderboardUser {
  userId: number;
  username: string;
  totalPoints: number;
  totalPredictions: number;
  rank?: number;
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
          message: "User not authenticated",
        });
      }

      // Validate input
      if (!fixtureId || homeScore === undefined || awayScore === undefined) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: fixtureId, homeScore, awayScore",
        });
      }

      // Convert to integers and validate
      const predictedHomeScore = parseInt(homeScore);
      const predictedAwayScore = parseInt(awayScore);

      if (isNaN(predictedHomeScore) || isNaN(predictedAwayScore)) {
        return res.status(400).json({
          success: false,
          message: "Scores must be valid numbers",
        });
      }

      if (
        predictedHomeScore < 0 ||
        predictedAwayScore < 0 ||
        predictedHomeScore > 20 ||
        predictedAwayScore > 20
      ) {
        return res.status(400).json({
          success: false,
          message: "Scores must be between 0 and 20",
        });
      }

      // Check if fixture exists and get its status
      const fixture = await Fixture.findByPk(fixtureId);
      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: "Fixture not found",
        });
      }

      // Check if match has finished or is live
      if (fixture.status === "finished" || fixture.status === "live") {
        return res.status(400).json({
          success: false,
          message:
            "Cannot update prediction after match has started or finished",
        });
      }

      // Check if deadline has passed
      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: "Prediction deadline has passed",
        });
      }

      // Check for existing prediction
      const existingPrediction = await Prediction.findOne({
        where: { userId, fixtureId },
      });

      if (existingPrediction) {
        // Update existing prediction - preserve isDouble if not specified
        existingPrediction.predictedHomeScore = predictedHomeScore;
        existingPrediction.predictedAwayScore = predictedAwayScore;

        // Only update isDouble if explicitly provided, otherwise keep existing value
        if (req.body.hasOwnProperty("isDouble")) {
          existingPrediction.isDouble = isDouble;
        }

        await existingPrediction.save();

        res.json({
          success: true,
          message: "Prediction updated successfully",
          data: existingPrediction,
        });
      } else {
        // Create new prediction
        const prediction = await Prediction.create({
          userId,
          fixtureId,
          predictedHomeScore,
          predictedAwayScore,
          isDouble,
          points: 0,
        });

        res.json({
          success: true,
          message: "Prediction created successfully",
          data: prediction,
        });
      }
    } catch (error: any) {
      console.error("Create prediction error:", error);
      res.status(500).json({
        success: false,
        message: "Error saving prediction",
        error: error.message,
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
          message: "User not authenticated",
        });
      }

      // Fix: Use the alias 'fixture' as defined in associations
      const predictions = await Prediction.findAll({
        where: { userId },
        include: [
          {
            model: Fixture,
            as: "fixture", // Use the alias defined in associations
            attributes: [
              "id",
              "homeTeam",
              "awayTeam",
              "matchDate",
              "gameweek",
              "status",
              "homeScore",
              "awayScore",
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error: any) {
      console.error("Get user predictions error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching predictions",
        error: error.message,
      });
    }
  }

  // Get user's predictions by gameweek
  async getUserPredictionsByGameweek(req: AuthenticatedRequest, res: Response) {
    try {
      const { gameweek } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Fix: Use the alias 'fixture' as defined in associations
      const predictions = await Prediction.findAll({
        where: { userId },
        include: [
          {
            model: Fixture,
            as: "fixture", // Use the alias defined in associations
            where: { gameweek: parseInt(gameweek) },
            attributes: [
              "id",
              "homeTeam",
              "awayTeam",
              "matchDate",
              "gameweek",
              "status",
              "homeScore",
              "awayScore",
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error: any) {
      console.error("Get user predictions by gameweek error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching predictions",
        error: error.message,
      });
    }
  }

  async getLeaderboard(req: AuthenticatedRequest, res: Response) {
    try {
      const { pool } = require("../config/database");

      const query = `
        SELECT 
          u.id as "userId",
          u.username,
          COALESCE(SUM(p.points), 0) as "totalPoints",
          COUNT(p.id) as "totalPredictions"
        FROM users u
        JOIN predictions p ON u.id = p.user_id
        GROUP BY u.id, u.username
        HAVING COUNT(p.id) > 0
        ORDER BY "totalPoints" DESC, "totalPredictions" DESC
      `;

      console.log("Executing leaderboard query...");
      const result = await pool.query(query);
      console.log("Leaderboard result:", result.rows);

      const leaderboard = result.rows.map((row: any, index: number) => ({
        rank: index + 1,
        userId: row.userId,
        username: row.username,
        totalPoints: parseInt(row.totalPoints) || 0,
        totalPredictions: parseInt(row.totalPredictions) || 0,
      }));

      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error: any) {
      console.error("Get leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching leaderboard",
        error: error.message,
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
          message: "User not authenticated",
        });
      }

      const prediction = await Prediction.findOne({
        where: { id, userId },
        include: [Fixture],
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: "Prediction not found",
        });
      }

      // Check if deadline has passed
      const fixture = prediction.fixture;
      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: "Prediction deadline has passed",
        });
      }

      // Update prediction
      prediction.predictedHomeScore = parseInt(homeScore);
      prediction.predictedAwayScore = parseInt(awayScore);
      prediction.isDouble = isDouble || false;
      await prediction.save();

      res.json({
        success: true,
        message: "Prediction updated successfully",
        data: prediction,
      });
    } catch (error: any) {
      console.error("Update prediction error:", error);
      res.status(500).json({
        success: false,
        message: "Error updating prediction",
        error: error.message,
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
          message: "User not authenticated",
        });
      }

      const prediction = await Prediction.findOne({
        where: { id, userId },
        include: [Fixture],
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: "Prediction not found",
        });
      }

      // Check if deadline has passed
      const fixture = prediction.fixture;
      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: "Prediction deadline has passed",
        });
      }

      await prediction.destroy();

      res.json({
        success: true,
        message: "Prediction deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete prediction error:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting prediction",
        error: error.message,
      });
    }
  }

  /* filepath: backend/src/controllers/predictions.controller.ts */
  // Add this method to the PredictionsController class:
  async recalculateAllPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const count = await Prediction.recalculateAllPoints();

      res.json({
        success: true,
        message: `Points recalculated for ${count} predictions`,
        data: { count },
      });
    } catch (error: any) {
      console.error("Recalculate points error:", error);
      res.status(500).json({
        success: false,
        message: "Error recalculating points",
        error: error.message,
      });
    }
  }
}

export const predictionsController = new PredictionsController();
