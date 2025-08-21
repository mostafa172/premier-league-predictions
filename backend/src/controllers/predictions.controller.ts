/* filepath: backend/src/controllers/predictions.controller.ts */
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { Prediction } from "../models/Prediction";
import { Fixture } from "../models/Fixture";
import { User } from "../models/User";
import { Team } from "../models/Team";
import { Op } from "sequelize";

export class PredictionsController {
  // Create single prediction
  async createPrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { fixtureId, homeScore, awayScore } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Validate input
      if (homeScore < 0 || awayScore < 0) {
        return res.status(400).json({
          success: false,
          message: "Scores cannot be negative",
        });
      }

      // Check if prediction already exists
      const existingPrediction = await Prediction.findOne({
        where: {
          userId: userId,
          fixtureId: fixtureId,
        },
      });

      if (existingPrediction) {
        return res.status(400).json({
          success: false,
          message: "Prediction already exists for this fixture",
        });
      }

      // Check if fixture exists and deadline hasn't passed
      const fixture = await Fixture.findByPk(fixtureId);

      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: "Fixture not found",
        });
      }

      if (new Date() > new Date(fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: "Prediction deadline has passed",
        });
      }

      if (fixture.status !== "upcoming") {
        return res.status(400).json({
          success: false,
          message: "Cannot predict on fixtures that have started or finished",
        });
      }

      // Create prediction
      const prediction = await Prediction.create({
        userId: userId,
        fixtureId: fixtureId,
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
      });

      res.json({
        success: true,
        data: prediction,
        message: "Prediction created successfully",
      });
    } catch (error) {
      console.error("Error creating prediction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update prediction
  /* filepath: backend/src/controllers/predictions.controller.ts */
  // Update prediction method
  async updatePrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { homeScore, awayScore, isDouble } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // Validate input
      if (homeScore < 0 || awayScore < 0) {
        return res.status(400).json({
          success: false,
          message: "Scores cannot be negative",
        });
      }

      // Find prediction with fixture info
      const prediction = await Prediction.findOne({
        where: {
          id: id,
          userId: userId,
        },
        include: [
          {
            model: Fixture,
            as: "fixture",
          },
        ],
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: "Prediction not found",
        });
      }

      // Check if deadline has passed
      if (new Date() > new Date(prediction.fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: "Prediction deadline has passed",
        });
      }

      if (prediction.fixture.status !== "upcoming") {
        return res.status(400).json({
          success: false,
          message:
            "Cannot update predictions for fixtures that have started or finished",
        });
      }

      // If this prediction is being set as double, unset any other double for this user/gameweek
      if (isDouble === true) {
        await Prediction.update(
          { isDouble: false },
          {
            where: {
              userId: userId,
              fixtureId: {
                [Op.in]: await Fixture.findAll({
                  where: { gameweek: prediction.fixture.gameweek },
                  attributes: ["id"],
                }).then((fixtures) => fixtures.map((f) => f.id)),
              },
              id: { [Op.ne]: id }, // Exclude current prediction
            },
          }
        );
      }

      // Update prediction including isDouble
      await prediction.update({
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
        isDouble: Boolean(isDouble), // Ensure it's stored as boolean
      });

      res.json({
        success: true,
        data: prediction,
        message: "Prediction updated successfully",
      });
    } catch (error) {
      console.error("Error updating prediction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "Unauthorized",
        });
      }

      // Find prediction with fixture info
      const prediction = await Prediction.findOne({
        where: {
          id: id,
          userId: userId,
        },
        include: [
          {
            model: Fixture,
            as: "fixture",
          },
        ],
      });

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: "Prediction not found",
        });
      }

      // Check if deadline has passed
      if (new Date() > new Date(prediction.fixture.deadline)) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete prediction after deadline",
        });
      }

      // Delete prediction
      await prediction.destroy();

      res.json({
        success: true,
        message: "Prediction deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting prediction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get user predictions
  async getUserPredictions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const predictions = await Prediction.findAll({
        where: { userId: userId },
        include: [
          {
            model: Fixture,
            as: "fixture",
            include: [
              {
                model: Team,
                as: "homeTeam",
                attributes: ["id", "name", "abbreviation", "logoUrl"],
              },
              {
                model: Team,
                as: "awayTeam",
                attributes: ["id", "name", "abbreviation", "logoUrl"],
              },
            ],
          },
        ],
        order: [
          ["fixture", "gameweek", "ASC"],
          ["fixture", "matchDate", "ASC"],
        ],
      });

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error) {
      console.error("Error getting user predictions:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get user predictions by gameweek
  async getUserPredictionsByGameweek(req: AuthenticatedRequest, res: Response) {
    try {
      const { gameweek } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const predictions = await Prediction.findAll({
        where: { userId: userId },
        include: [
          {
            model: Fixture,
            as: "fixture",
            where: { gameweek: parseInt(gameweek) },
            include: [
              {
                model: Team,
                as: "homeTeam",
                attributes: ["id", "name", "abbreviation", "logoUrl"],
              },
              {
                model: Team,
                as: "awayTeam",
                attributes: ["id", "name", "abbreviation", "logoUrl"],
              },
            ],
          },
        ],
        order: [["fixture", "matchDate", "ASC"]],
      });

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error) {
      console.error("Error getting user predictions by gameweek:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get leaderboard
  async getLeaderboard(req: AuthenticatedRequest, res: Response) {
    try {
      const leaderboard = await User.findAll({
        attributes: [
          "id",
          "username",
          [
            // Sum of points from all predictions
            User.sequelize!.fn(
              "COALESCE",
              User.sequelize!.fn(
                "SUM",
                User.sequelize!.col("predictions.points")
              ),
              0
            ),
            "totalPoints",
          ],
          [
            // Count of total predictions
            User.sequelize!.fn("COUNT", User.sequelize!.col("predictions.id")),
            "totalPredictions",
          ],
        ],
        include: [
          {
            model: Prediction,
            as: "predictions",
            attributes: [],
            required: false,
          },
        ],
        group: ["User.id", "User.username"],
        order: [
          [User.sequelize!.literal("totalPoints"), "DESC"],
          [User.sequelize!.literal("totalPredictions"), "DESC"],
          ["username", "ASC"],
        ],
      });

      // Format the response
      const formattedLeaderboard = leaderboard.map((user: any) => ({
        userId: user.id,
        username: user.username,
        totalPoints: parseInt(user.dataValues.totalPoints) || 0,
        totalPredictions: parseInt(user.dataValues.totalPredictions) || 0,
      }));

      res.json({
        success: true,
        data: formattedLeaderboard,
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

export const predictionsController = new PredictionsController();
