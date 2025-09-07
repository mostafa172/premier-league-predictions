/* filepath: backend/src/controllers/fixtures.controller.ts */
import { Request, Response } from "express";
import { Fixture, FixtureStatus } from "../models/Fixture";
import { Team } from "../models/Team";
import { col, fn, Op } from "sequelize";
import { Prediction } from "../models/Prediction";
import sequelize from "sequelize";

// UPCOMING → LIVE when kickoff time arrives and no scores yet
function needsLive(fx: Fixture): boolean {
  return (
    fx.status === FixtureStatus.UPCOMING &&
    new Date() >= new Date(fx.matchDate) &&
    fx.homeScore == null &&
    fx.awayScore == null
  );
}

async function ensureLiveStatus(fixtures: Fixture[]): Promise<Fixture[]> {
  const toLive = fixtures.filter(needsLive);
  if (toLive.length > 0) {
    const ids = toLive.map((f) => f.id);
    await Fixture.update(
      { status: FixtureStatus.LIVE },
      { where: { id: ids } }
    );
    const refreshed = await Fixture.findAll({
      where: { id: ids },
      include: [
        {
          model: Team,
          as: "homeTeam",
          attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"],
        },
        {
          model: Team,
          as: "awayTeam",
          attributes: ["id", "name", "abbreviation", "logoUrl", "colorPrimary"],
        },
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

// Helpers: ensure incoming date strings are valid ISO (preferably with Z)
function parseIsoToDate(
  value: string | Date | undefined,
  fieldName: string
): Date | undefined {
  if (value == null) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format for ${fieldName}`);
  }
  return d;
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
      const withLive = await ensureLiveStatus(fixtures);
      return res.status(200).json({ success: true, data: withLive });
    } catch (error) {
      console.error("Get all fixtures error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error fetching fixtures" });
    }
  }

  // Get fixture by ID
  public async getFixtureById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      let fixture = await Fixture.findByPk(id, {
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
      if (!fixture)
        return res
          .status(404)
          .json({ success: false, message: "Fixture not found" });

      if (needsLive(fixture)) {
        await fixture.update({ status: FixtureStatus.LIVE });
        fixture = await Fixture.findByPk(id, {
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
      }

      return res.status(200).json({ success: true, data: fixture });
    } catch (error) {
      console.error("Get fixture by ID error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error fetching fixture" });
    }
  }

  // Get fixtures by gameweek
  public async getFixturesByGameweek(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { gameweek } = req.params;
      const fixtures = await Fixture.findAll({
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
      const withLive = await ensureLiveStatus(fixtures);
      return res.status(200).json({ success: true, data: withLive });
    } catch (error) {
      console.error("Get fixtures by gameweek error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching fixtures by gameweek",
      });
    }
  }

  // Get upcoming fixtures
  public async getUpcomingFixtures(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      let fixtures = await Fixture.findAll({
        where: {
          status: FixtureStatus.UPCOMING,
          matchDate: {
            [Op.gte]: new Date(new Date().getTime() - 3 * 60 * 1000),
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
      fixtures = await ensureLiveStatus(fixtures);
      fixtures = fixtures.filter((f) => f.status === FixtureStatus.UPCOMING);
      return res.status(200).json({ success: true, data: fixtures });
    } catch (error) {
      console.error("Get upcoming fixtures error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error fetching upcoming fixtures" });
    }
  }

  // Create fixture (expects UTC ISO strings like "2025-08-23T00:45:00.000Z")
  public async createFixture(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { homeTeamId, awayTeamId, matchDate, deadline, gameweek } =
        req.body;

      if (!homeTeamId || !awayTeamId || !matchDate || !deadline || !gameweek) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      const homeTeam = await Team.findByPk(homeTeamId);
      const awayTeam = await Team.findByPk(awayTeamId);
      if (!homeTeam || !awayTeam)
        return res
          .status(400)
          .json({ success: false, message: "Invalid team IDs" });
      if (homeTeamId === awayTeamId) {
        return res.status(400).json({
          success: false,
          message: "Home and away teams must be different",
        });
      }

      const fixture = await Fixture.create({
        homeTeamId,
        awayTeamId,
        matchDate: new Date(matchDate),
        deadline: new Date(deadline),
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
    } catch (error: any) {
      console.error("Create fixture error:", error);
      const msg = /Invalid date format/.test(error?.message)
        ? error.message
        : "Error creating fixture";
      return res.status(500).json({ success: false, message: msg });
    }
  }

  // Update fixture (also expects UTC ISO strings from frontend)
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
      if (!fixture)
        return res
          .status(404)
          .json({ success: false, message: "Fixture not found" });

      const updateData: any = {};
      if (homeTeamId) updateData.homeTeamId = homeTeamId;
      if (awayTeamId) updateData.awayTeamId = awayTeamId;
      if (matchDate) updateData.matchDate = new Date(matchDate);
      if (deadline) updateData.deadline = new Date(deadline);
      if (gameweek) updateData.gameweek = gameweek;
      if (homeScore !== undefined) updateData.homeScore = homeScore;
      if (awayScore !== undefined) updateData.awayScore = awayScore;

      if (
        homeScore !== undefined &&
        awayScore !== undefined &&
        homeScore !== null &&
        awayScore !== null
      ) {
        updateData.status = FixtureStatus.FINISHED;
      } else if (status) {
        if (Object.values(FixtureStatus).includes(status)) {
          updateData.status = status;
        } else {
          return res
            .status(400)
            .json({ success: false, message: "Invalid fixture status" });
        }
      }

      await fixture.update(updateData);

      // Recalc if finished
      if (
        updateData.status === FixtureStatus.FINISHED &&
        updateData.homeScore !== undefined &&
        updateData.awayScore !== undefined
      ) {
        const predictions = await Prediction.findAll({
          where: { fixtureId: id },
        });
        for (const p of predictions) await p.calculateAndUpdatePoints();
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
    } catch (error: any) {
      console.error("Update fixture error:", error);
      const msg = /Invalid date format/.test(error?.message)
        ? error.message
        : "Error updating fixture";
      return res.status(500).json({ success: false, message: msg });
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
      if (!fixture)
        return res
          .status(404)
          .json({ success: false, message: "Fixture not found" });
      await fixture.destroy();
      return res
        .status(200)
        .json({ success: true, message: "Fixture deleted successfully" });
    } catch (error) {
      console.error("Delete fixture error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error deleting fixture" });
    }
  }

  public async getClosestGameweek(req: Request, res: Response) {
    try {
      // first/last kickoff per GW
      const rows: any[] = await Fixture.findAll({
        attributes: [
          "gameweek",
          [fn("MIN", col("match_date")), "firstKick"],
          [fn("MAX", col("match_date")), "lastKick"],
        ],
        group: ["gameweek"],
        order: [["gameweek", "ASC"]],
      });

      const now = Date.now();
      let bestGw = 1,
        bestDist = Number.POSITIVE_INFINITY;

      for (const r of rows) {
        const first = +new Date(r.get("firstKick"));
        const last = +new Date(r.get("lastKick"));
        let dist = 0;
        if (now < first) dist = first - now;
        else if (now > last) dist = now - last;
        else dist = 0;
        if (dist < bestDist) {
          bestDist = dist;
          bestGw = Number(r.get("gameweek"));
        }
      }

      return res.json({ success: true, data: { gameweek: bestGw } });
    } catch (e) {
      console.error("getClosestGameweek error", e);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  public async getClosestActiveGameweek(req: Request, res: Response) {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      // First, check for gameweeks with unfinished matches
      const unfinishedGameweeks = await Fixture.findAll({
        attributes: [
          "gameweek",
          [fn("COUNT", col("id")), "totalMatches"],
          [
            fn(
              "SUM",
              sequelize.literal(
                "CASE WHEN status = 'finished' THEN 1 ELSE 0 END"
              )
            ),
            "finishedMatches",
          ],
        ],
        group: ["gameweek"],
        order: [["gameweek", "ASC"]],
        having: sequelize.literal(
          "COUNT(id) > SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END)"
        ),
      });

      if (unfinishedGameweeks.length > 0) {
        const closestUnfinished = unfinishedGameweeks[0];
        return res.json({
          success: true,
          data: { gameweek: Number(closestUnfinished.get("gameweek")) },
        });
      }

      // If no unfinished gameweeks, find the last finished gameweek
      const lastFinishedGameweek = await Fixture.findOne({
        attributes: ["gameweek", [fn("MAX", col("match_date")), "lastMatch"]],
        where: {
          status: FixtureStatus.FINISHED,
        },
        group: ["gameweek"],
        order: [["gameweek", "DESC"]],
        limit: 1,
      });

      if (lastFinishedGameweek) {
        const lastMatchDate = new Date(
          lastFinishedGameweek.get("lastMatch") as string
        );
        const lastMatchDay = new Date(
          lastMatchDate.getFullYear(),
          lastMatchDate.getMonth(),
          lastMatchDate.getDate()
        );

        // If we're still on the same day as the last match, return that gameweek
        if (todayStart.getTime() === lastMatchDay.getTime()) {
          return res.json({
            success: true,
            data: { gameweek: Number(lastFinishedGameweek.get("gameweek")) },
          });
        }

        // If the day has passed, return next gameweek
        const nextGameweek = Number(lastFinishedGameweek.get("gameweek")) + 1;
        return res.json({
          success: true,
          data: { gameweek: Math.min(nextGameweek, 38) }, // Cap at 38
        });
      }

      // Fallback to gameweek 1 if no finished matches found
      return res.json({ success: true, data: { gameweek: 1 } });
    } catch (e) {
      console.error("getClosestActiveGameweek error", e);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
}

export const fixturesController = new FixturesController();
