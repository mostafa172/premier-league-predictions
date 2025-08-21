/* filepath: backend/src/controllers/fixtures.controller.ts */
import { Request, Response } from 'express';
import { Fixture, FixtureStatus } from '../models/Fixture';
import { Team } from '../models/Team';

export class FixturesController {
  public async getAllFixtures(req: Request, res: Response): Promise<Response> {
    try {
      const fixtures = await Fixture.findAll({
        include: [
          {
            model: Team,
            as: 'homeTeam',
            attributes: ['id', 'name', 'abbreviation', 'logoUrl', 'colorPrimary']
          },
          {
            model: Team,
            as: 'awayTeam',
            attributes: ['id', 'name', 'abbreviation', 'logoUrl', 'colorPrimary']
          }
        ],
        order: [['matchDate', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        data: fixtures
      });
    } catch (error) {
      console.error('Get all fixtures error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching fixtures',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async createFixture(req: Request, res: Response): Promise<Response> {
    try {
      const { homeTeamId, awayTeamId, matchDate, deadline, gameweek } = req.body;

      // Validate required fields
      if (!homeTeamId || !awayTeamId || !matchDate || !deadline || !gameweek) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: homeTeamId, awayTeamId, matchDate, deadline, gameweek'
        });
      }

      // Validate teams exist
      const homeTeam = await Team.findByPk(homeTeamId);
      const awayTeam = await Team.findByPk(awayTeamId);

      if (!homeTeam || !awayTeam) {
        return res.status(400).json({
          success: false,
          message: 'Invalid team IDs'
        });
      }

      // Validate teams are different
      if (homeTeamId === awayTeamId) {
        return res.status(400).json({
          success: false,
          message: 'Home and away teams must be different'
        });
      }

      const fixture = await Fixture.create({
        homeTeamId,
        awayTeamId,
        matchDate: new Date(matchDate),
        deadline: new Date(deadline),
        gameweek,
        status: FixtureStatus.UPCOMING
      });

      // Fetch the created fixture with team details
      const createdFixture = await Fixture.findByPk(fixture.id, {
        include: [
          {
            model: Team,
            as: 'homeTeam',
            attributes: ['id', 'name', 'abbreviation', 'logoUrl', 'colorPrimary']
          },
          {
            model: Team,
            as: 'awayTeam',
            attributes: ['id', 'name', 'abbreviation', 'logoUrl', 'colorPrimary']
          }
        ]
      });

      return res.status(201).json({
        success: true,
        message: 'Fixture created successfully',
        data: createdFixture
      });
    } catch (error) {
      console.error('Create fixture error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating fixture',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update other methods similarly to include team data...
}