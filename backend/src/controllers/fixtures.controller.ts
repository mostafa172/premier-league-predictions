/* filepath: backend/src/controllers/fixtures.controller.ts */
import { Request, Response } from "express";
import { Fixture, FixtureStatus } from "../models/Fixture";
import { Team } from "../models/Team";
import { Op } from "sequelize";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    isAdmin: boolean;
  };
}

// utils/dates.ts (or place near top of controller file)
function localInputToUTC(dateStr: string | Date): Date {
  // Accept 'YYYY-MM-DDTHH:mm' or a Date
  const d = new Date(dateStr);
  // Build a UTC date by removing the local offset
  const utcTime = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(utcTime);
}

export class FixturesController {
  // Get all fixtures
  public async getAllFixtures(req: Request, res: Response): Promise<Response> {
    try {
      const fixtures = await Fixture.findAll({
        include: [
          {
            model: Team,
            as: "homeTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
          {
            model: Team,
            as: "awayTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
        ],
        order: [["matchDate", "ASC"]],
      });

      return res.status(200).json({
        success: true,
        data: fixtures,
      });
    } catch (error) {
      console.error("Get all fixtures error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching fixtures",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get fixture by ID
  public async getFixtureById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const fixture = await Fixture.findByPk(id, {
        include: [
          {
            model: Team,
            as: "homeTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
          {
            model: Team,
            as: "awayTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
        ],
      });

      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: "Fixture not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: fixture,
      });
    } catch (error) {
      console.error("Get fixture by ID error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching fixture",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get fixtures by gameweek
  public async getFixturesByGameweek(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { gameweek } = req.params;

      const fixturesWithTeams = await Fixture.findAll({
        where: { gameweek: parseInt(gameweek) },
        include: [
          {
            model: Team,
            as: "homeTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
          {
            model: Team,
            as: "awayTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
        ],
        order: [["matchDate", "ASC"]],
      });

      return res.status(200).json({
        success: true,
        data: fixturesWithTeams,
      });
    } catch (error) {
      console.error("Get fixtures by gameweek error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching fixtures by gameweek",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get upcoming fixtures
  public async getUpcomingFixtures(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const fixturesWithTeams = await Fixture.findAll({
        where: {
          status: FixtureStatus.UPCOMING, // Use enum instead of string
          matchDate: {
            [Op.gte]: new Date(),
          },
        },
        include: [
          {
            model: Team,
            as: "homeTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
          {
            model: Team,
            as: "awayTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
        ],
        order: [["matchDate", "ASC"]],
      });

      return res.status(200).json({
        success: true,
        data: fixturesWithTeams,
      });
    } catch (error) {
      console.error("Get upcoming fixtures error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching upcoming fixtures",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create fixture
  public async createFixture(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { homeTeamId, awayTeamId, matchDate, deadline, gameweek } =
        req.body;

      if (!homeTeamId || !awayTeamId || !matchDate || !deadline || !gameweek) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      const homeTeam = await Team.findByPk(homeTeamId);
      const awayTeam = await Team.findByPk(awayTeamId);

      if (!homeTeam || !awayTeam) {
        return res.status(400).json({
          success: false,
          message: "Invalid team IDs",
        });
      }

      if (homeTeamId === awayTeamId) {
        return res.status(400).json({
          success: false,
          message: "Home and away teams must be different",
        });
      }

      const fixture = await Fixture.create({
        homeTeamId,
        awayTeamId,
        matchDate: localInputToUTC(matchDate),
        deadline: localInputToUTC(deadline),
        gameweek,
        status: FixtureStatus.UPCOMING,
      });

      const createdFixture = await Fixture.findByPk(fixture.id, {
        include: [
          {
            model: Team,
            as: "homeTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
          {
            model: Team,
            as: "awayTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
        ],
      });

      return res.status(201).json({
        success: true,
        message: "Fixture created successfully",
        data: createdFixture,
      });
    } catch (error) {
      console.error("Create fixture error:", error);
      return res.status(500).json({
        success: false,
        message: "Error creating fixture",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update fixture
  public async updateFixture(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        homeTeamId,
        awayTeamId,
        matchDate,
        deadline,
        gameweek,
        homeScore,
        awayScore,
        status,
      } = req.body;

      const fixture = await Fixture.findByPk(id);

      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: "Fixture not found",
        });
      }

      const updateData: any = {};
      if (homeTeamId) updateData.homeTeamId = homeTeamId;
      if (awayTeamId) updateData.awayTeamId = awayTeamId;
      if (matchDate) updateData.matchDate = localInputToUTC(matchDate);
      if (deadline) updateData.deadline = localInputToUTC(deadline);
      if (gameweek) updateData.gameweek = gameweek;

      if (homeScore !== undefined) updateData.homeScore = homeScore;
      if (awayScore !== undefined) updateData.awayScore = awayScore;

      // AUTO-UPDATE STATUS LOGIC
      // If both scores are provided and not null, automatically set status to 'finished'
      if (
        homeScore !== undefined &&
        awayScore !== undefined &&
        homeScore !== null &&
        awayScore !== null
      ) {
        updateData.status = FixtureStatus.FINISHED;
        console.log(
          `🏁 Auto-setting fixture ${id} status to 'finished' due to scores being added`
        );
      } else if (status) {
        // Only use provided status if scores aren't being set
        if (Object.values(FixtureStatus).includes(status)) {
          updateData.status = status;
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid fixture status",
          });
        }
      }

      await fixture.update(updateData);

      // If fixture is now finished, recalculate prediction points
      if (
        updateData.status === FixtureStatus.FINISHED &&
        updateData.homeScore !== undefined &&
        updateData.awayScore !== undefined
      ) {
        console.log(`🔄 Recalculating points for fixture ${id} predictions...`);

        // Import Prediction model at the top of the file if not already imported
        const { Prediction } = await import("../models/Prediction");

        const predictions = await Prediction.findAll({
          where: { fixtureId: id },
          include: [
            {
              model: Fixture,
              as: "fixture",
            },
          ],
        });

        let updatedPredictions = 0;
        for (const prediction of predictions) {
          await prediction.calculateAndUpdatePoints();
          updatedPredictions++;
        }

        console.log(
          `✅ Updated ${updatedPredictions} prediction points for fixture ${id}`
        );
      }

      const updatedFixture = await Fixture.findByPk(id, {
        include: [
          {
            model: Team,
            as: "homeTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
          {
            model: Team,
            as: "awayTeam",
            attributes: [
              "id",
              "name",
              "abbreviation",
              "logoUrl",
              "colorPrimary",
            ],
          },
        ],
      });

      return res.status(200).json({
        success: true,
        message: "Fixture updated successfully",
        data: updatedFixture,
      });
    } catch (error) {
      console.error("Update fixture error:", error);
      return res.status(500).json({
        success: false,
        message: "Error updating fixture",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Delete fixture
  public async deleteFixture(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params;

      const fixture = await Fixture.findByPk(id);

      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: "Fixture not found",
        });
      }

      await fixture.destroy();

      return res.status(200).json({
        success: true,
        message: "Fixture deleted successfully",
      });
    } catch (error) {
      console.error("Delete fixture error:", error);
      return res.status(500).json({
        success: false,
        message: "Error deleting fixture",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Add the missing export
export const fixturesController = new FixturesController();
