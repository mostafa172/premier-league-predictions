import { Request, Response } from "express";
import { Fixture, FixtureStatus } from "../models/Fixture";
import { Team } from "../models/Team";
import { Op } from "sequelize";
import { Prediction } from "../models/Prediction";

// If a fixture is UPCOMING and now >= matchDate and it doesn’t already have scores, flip to LIVE.
function needsLive(fx: Fixture): boolean {
  return (
    fx.status === FixtureStatus.UPCOMING &&
    new Date() >= new Date(fx.matchDate) &&
    (fx.homeScore == null && fx.awayScore == null)
  );
}

async function ensureLiveStatus(fixtures: Fixture[]): Promise<Fixture[]> {
  const toLive = fixtures.filter(needsLive);
  if (toLive.length > 0) {
    const ids = toLive.map((f) => f.id);
    await Fixture.update({ status: FixtureStatus.LIVE }, { where: { id: ids } });
    const refreshed = await Fixture.findAll({
      where: { id: ids },
      include: [
        { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
      ],
    });
    const map = new Map(refreshed.map((f) => [f.id, f]));
    return fixtures.map((f) => map.get(f.id) ?? f);
  }
  return fixtures;
}

interface AuthenticatedRequest extends Request {
  user?: { id: number; username: string; email: string; isAdmin: boolean };
}

export class FixturesController {
  // Get all fixtures
  public async getAllFixtures(req: Request, res: Response): Promise<Response> {
    try {
      const fixtures = await Fixture.findAll({
        include: [
          { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        ],
        order: [["matchDate", "ASC"]],
      });

      const withLive = await ensureLiveStatus(fixtures);
      return res.status(200).json({ success: true, data: withLive });
    } catch (error) {
      console.error("Get all fixtures error:", error);
      return res.status(500).json({ success: false, message: "Error fetching fixtures" });
    }
  }

  // Get fixture by ID
  public async getFixtureById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      let fixture = await Fixture.findByPk(id, {
        include: [
          { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        ],
      });

      if (!fixture) return res.status(404).json({ success: false, message: "Fixture not found" });

      if (needsLive(fixture)) {
        await fixture.update({ status: FixtureStatus.LIVE });
        fixture = await Fixture.findByPk(id, {
          include: [
            { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
            { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          ],
        });
      }

      return res.status(200).json({ success: true, data: fixture });
    } catch (error) {
      console.error("Get fixture by ID error:", error);
      return res.status(500).json({ success: false, message: "Error fetching fixture" });
    }
  }

  // Get fixtures by gameweek
  public async getFixturesByGameweek(req: Request, res: Response): Promise<Response> {
    try {
      const { gameweek } = req.params;
      const fixturesWithTeams = await Fixture.findAll({
        where: { gameweek: parseInt(gameweek) },
        include: [
          { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        ],
        order: [["matchDate", "ASC"]],
      });

      const withLive = await ensureLiveStatus(fixturesWithTeams);
      return res.status(200).json({ success: true, data: withLive });
    } catch (error) {
      console.error("Get fixtures by gameweek error:", error);
      return res.status(500).json({ success: false, message: "Error fetching fixtures by gameweek" });
    }
  }

  // Get upcoming fixtures
  public async getUpcomingFixtures(req: Request, res: Response): Promise<Response> {
    try {
      let fixturesWithTeams = await Fixture.findAll({
        where: {
          status: FixtureStatus.UPCOMING,
          matchDate: { [Op.gte]: new Date(new Date().getTime() - 3 * 60 * 1000) }, // small slack
        },
        include: [
          { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        ],
        order: [["matchDate", "ASC"]],
      });

      fixturesWithTeams = await ensureLiveStatus(fixturesWithTeams);
      // keep only those still upcoming here
      fixturesWithTeams = fixturesWithTeams.filter((f) => f.status === FixtureStatus.UPCOMING);

      return res.status(200).json({ success: true, data: fixturesWithTeams });
    } catch (error) {
      console.error("Get upcoming fixtures error:", error);
      return res.status(500).json({ success: false, message: "Error fetching upcoming fixtures" });
    }
  }

  // Create fixture
  public async createFixture(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { homeTeamId, awayTeamId, matchDate, deadline, gameweek } = req.body;

      if (!homeTeamId || !awayTeamId || !matchDate || !deadline || !gameweek) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const homeTeam = await Team.findByPk(homeTeamId);
      const awayTeam = await Team.findByPk(awayTeamId);
      if (!homeTeam || !awayTeam) return res.status(400).json({ success: false, message: "Invalid team IDs" });
      if (homeTeamId === awayTeamId) {
        return res.status(400).json({ success: false, message: "Home and away teams must be different" });
      }

      const fixture = await Fixture.create({
        homeTeamId, awayTeamId,
        matchDate: new Date(matchDate),
        deadline: new Date(deadline),
        gameweek,
        status: FixtureStatus.UPCOMING,
      });

      const createdFixture = await Fixture.findByPk(fixture.id, {
        include: [
          { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        ],
      });

      return res.status(201).json({ success: true, message: "Fixture created successfully", data: createdFixture });
    } catch (error) {
      console.error("Create fixture error:", error);
      return res.status(500).json({ success: false, message: "Error creating fixture" });
    }
  }

  // Update fixture
  public async updateFixture(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const {
        homeTeamId, awayTeamId, matchDate, deadline, gameweek,
        homeScore, awayScore, status,
      } = req.body;

      const fixture = await Fixture.findByPk(id);
      if (!fixture) return res.status(404).json({ success: false, message: "Fixture not found" });

      const updateData: any = {};
      if (homeTeamId) updateData.homeTeamId = homeTeamId;
      if (awayTeamId) updateData.awayTeamId = awayTeamId;
      if (matchDate) updateData.matchDate = new Date(matchDate);
      if (deadline) updateData.deadline = new Date(deadline);
      if (gameweek) updateData.gameweek = gameweek;
      if (homeScore !== undefined) updateData.homeScore = homeScore;
      if (awayScore !== undefined) updateData.awayScore = awayScore;

      // When both scores present, mark finished
      if (
        homeScore !== undefined && awayScore !== undefined &&
        homeScore !== null && awayScore !== null
      ) {
        updateData.status = FixtureStatus.FINISHED;
        console.log(`🏁 Auto-setting fixture ${id} status to 'finished' due to scores being added`);
      } else if (status) {
        if (Object.values(FixtureStatus).includes(status)) {
          updateData.status = status;
        } else {
          return res.status(400).json({ success: false, message: "Invalid fixture status" });
        }
      }

      await fixture.update(updateData);

      // If just finished, recalc all predictions for this fixture
      if (
        updateData.status === FixtureStatus.FINISHED &&
        updateData.homeScore !== undefined && updateData.awayScore !== undefined
      ) {
        console.log(`🔄 Recalculating points for fixture ${id} predictions...`);
        const predictions = await Prediction.findAll({ where: { fixtureId: id } });
        for (const p of predictions) {
          await p.calculateAndUpdatePoints();
        }
        console.log(`✅ Updated ${predictions.length} prediction points for fixture ${id}`);
      }

      const updatedFixture = await Fixture.findByPk(id, {
        include: [
          { model: Team, as: "homeTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
          { model: Team, as: "awayTeam", attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"] },
        ],
      });

      return res.status(200).json({ success: true, message: "Fixture updated successfully", data: updatedFixture });
    } catch (error) {
      console.error("Update fixture error:", error);
      return res.status(500).json({ success: false, message: "Error updating fixture" });
    }
  }

  // Delete fixture
  public async deleteFixture(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const fixture = await Fixture.findByPk(id);
      if (!fixture) return res.status(404).json({ success: false, message: "Fixture not found" });

      await fixture.destroy();
      return res.status(200).json({ success: true, message: "Fixture deleted successfully" });
    } catch (error) {
      console.error("Delete fixture error:", error);
      return res.status(500).json({ success: false, message: "Error deleting fixture" });
    }
  }
}

export const fixturesController = new FixturesController();