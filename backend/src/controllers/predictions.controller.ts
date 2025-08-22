/* filepath: backend/src/controllers/predictions.controller.ts */
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { Prediction } from "../models/Prediction";
import { Fixture } from "../models/Fixture";
import { User } from "../models/User";
import { Team } from "../models/Team";
import { Op } from "sequelize";
import { sequelize } from "../config/sequelize";

function isFixtureLocked(fixture: Fixture) {
  // locked if deadline passed or not upcoming
  return (
    new Date() >= new Date(fixture.deadline) || fixture.status !== "upcoming"
  );
}

export class PredictionsController {
  // Create single prediction
  async createPrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { fixtureId, homeScore, awayScore, isDouble } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Validate
      if (homeScore < 0 || awayScore < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Scores cannot be negative" });
      }

      // Ensure no existing prediction
      const existingPrediction = await Prediction.findOne({
        where: { userId, fixtureId },
      });
      if (existingPrediction) {
        return res.status(400).json({
          success: false,
          message: "Prediction already exists for this fixture",
        });
      }

      // Validate fixture & deadline
      const fixture = await Fixture.findByPk(fixtureId);
      if (!fixture) {
        return res
          .status(404)
          .json({ success: false, message: "Fixture not found" });
      }
      if (new Date() > new Date(fixture.deadline)) {
        return res
          .status(400)
          .json({ success: false, message: "Prediction deadline has passed" });
      }
      if (fixture.status !== "upcoming") {
        return res.status(400).json({
          success: false,
          message: "Cannot predict on fixtures that have started or finished",
        });
      }

      // If creating a double, enforce locking rule across this gameweek
      if (isDouble === true) {
        const sameGwFixtures = await Fixture.findAll({
          where: { gameweek: fixture.gameweek },
          attributes: ["id", "deadline", "status"],
        });
        const sameGwFixtureIds = sameGwFixtures.map((f) => f.id);

        const existingDoubles = await Prediction.findAll({
          where: {
            userId,
            isDouble: true,
            fixtureId: { [Op.in]: sameGwFixtureIds },
          },
          include: [
            {
              model: Fixture,
              as: "fixture",
              attributes: ["id", "deadline", "status"],
            },
          ],
        });

        // If any existing double is already locked, you cannot add another
        const lockedDoubleExists = existingDoubles.some(
          (p) => p.fixture && isFixtureLocked(p.fixture)
        );
        if (lockedDoubleExists) {
          return res.status(400).json({
            success: false,
            message:
              "Double pick for this gameweek is locked (an existing double's deadline has passed).",
          });
        }

        // Otherwise, clear doubles only on UNLOCKED fixtures (allow pre-deadline switching)
        const unlockedFixtureIds = sameGwFixtures
          .filter((f) => !isFixtureLocked(f))
          .map((f) => f.id);
        if (unlockedFixtureIds.length > 0) {
          await Prediction.update(
            { isDouble: false },
            { where: { userId, fixtureId: { [Op.in]: unlockedFixtureIds } } }
          );
        }
      }

      // Create prediction
      const prediction = await Prediction.create({
        userId,
        fixtureId,
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
        isDouble: Boolean(isDouble),
      });

      return res.json({
        success: true,
        data: prediction,
        message: "Prediction created successfully",
      });
    } catch (error) {
      console.error("Error creating prediction:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  // Update prediction
  async updatePrediction(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { homeScore, awayScore, isDouble } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Validate
      if (homeScore < 0 || awayScore < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Scores cannot be negative" });
      }

      // Load prediction with fixture
      const prediction = await Prediction.findOne({
        where: { id, userId },
        include: [{ model: Fixture, as: "fixture" }],
      });
      if (!prediction) {
        return res
          .status(404)
          .json({ success: false, message: "Prediction not found" });
      }

      // Deadline & status checks
      if (new Date() > new Date(prediction.fixture.deadline)) {
        return res
          .status(400)
          .json({ success: false, message: "Prediction deadline has passed" });
      }
      if (prediction.fixture.status !== "upcoming") {
        return res.status(400).json({
          success: false,
          message:
            "Cannot update predictions for fixtures that have started or finished",
        });
      }

      // If toggling double on, enforce locking rule across same GW
      if (isDouble === true) {
        const sameGwFixtures = await Fixture.findAll({
          where: { gameweek: prediction.fixture.gameweek },
          attributes: ["id", "deadline", "status"],
        });
        const sameGwFixtureIds = sameGwFixtures.map((f) => f.id);

        const existingDoubles = await Prediction.findAll({
          where: {
            userId,
            isDouble: true,
            fixtureId: { [Op.in]: sameGwFixtureIds },
            id: { [Op.ne]: id },
          },
          include: [
            {
              model: Fixture,
              as: "fixture",
              attributes: ["id", "deadline", "status"],
            },
          ],
        });

        const lockedDoubleExists = existingDoubles.some(
          (p) => p.fixture && isFixtureLocked(p.fixture)
        );
        if (lockedDoubleExists) {
          return res.status(400).json({
            success: false,
            message:
              "Double pick for this gameweek is locked (an existing double's deadline has passed).",
          });
        }

        const unlockedFixtureIds = sameGwFixtures
          .filter((f) => !isFixtureLocked(f))
          .map((f) => f.id);
        if (unlockedFixtureIds.length > 0) {
          await Prediction.update(
            { isDouble: false },
            {
              where: {
                userId,
                fixtureId: { [Op.in]: unlockedFixtureIds },
                id: { [Op.ne]: id },
              },
            }
          );
        }
      }

      // Update
      await prediction.update({
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
        isDouble: Boolean(isDouble),
      });

      return res.json({
        success: true,
        data: prediction,
        message: "Prediction updated successfully",
      });
    } catch (error) {
      console.error("Error updating prediction:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
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

  async getLeaderboard(req: Request, res: Response) {
    try {
      console.log("🏆 Getting leaderboard...");

      const [results] = await sequelize.query(`
        SELECT 
          u.id,
          u.username,
          COALESCE(SUM(p.points), 0) as "totalPoints"
        FROM users u
        LEFT JOIN predictions p ON u.id = p.user_id
        GROUP BY u.id, u.username
        ORDER BY "totalPoints" DESC, u.username ASC
      `);

      console.log(`📊 Found ${(results as any[]).length} users in leaderboard`);

      // Format with rank
      const formattedLeaderboard = (results as any[]).map(
        (user: any, index: number) => ({
          userId: user.id,
          username: user.username,
          totalPoints: parseInt(user.totalPoints || 0, 10),
          rank: index + 1,
        })
      );

      return res.status(200).json({
        success: true,
        data: formattedLeaderboard,
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

export const predictionsController = new PredictionsController();
