import { Request, Response } from 'express';
import { Fixture, FixtureStatus } from '../models/Fixture'; // Import FixtureStatus enum
import { Prediction } from '../models/Prediction';

export class FixturesController {
  public async getAllFixtures(req: Request, res: Response): Promise<Response> {
    try {
      const fixtures = await Fixture.findAll({
        order: [['matchDate', 'ASC']],
        include: [{
          model: Prediction,
          required: false,
          attributes: ['id']
        }]
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

  public async getFixturesByGameweek(req: Request, res: Response): Promise<Response> {
    try {
      const { gameweek } = req.params;
      const fixtures = await Fixture.findByGameweek(parseInt(gameweek));

      return res.status(200).json({
        success: true,
        data: fixtures
      });
    } catch (error) {
      console.error('Get fixtures by gameweek error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching fixtures by gameweek',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async getUpcomingFixtures(req: Request, res: Response): Promise<Response> {
    try {
      const fixtures = await Fixture.findUpcoming();

      return res.status(200).json({
        success: true,
        data: fixtures
      });
    } catch (error) {
      console.error('Get upcoming fixtures error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching upcoming fixtures',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async getFixtureById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const fixture = await Fixture.findByPk(parseInt(id), {
        include: [{
          model: Prediction,
          required: false
        }]
      });

      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: 'Fixture not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: fixture
      });
    } catch (error) {
      console.error('Get fixture by ID error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching fixture',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async createFixture(req: Request, res: Response): Promise<Response> {
    try {
      const { homeTeam, awayTeam, matchDate, deadline, gameweek } = req.body;

      // Validate required fields
      if (!homeTeam || !awayTeam || !matchDate || !deadline || !gameweek) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: homeTeam, awayTeam, matchDate, deadline, gameweek'
        });
      }

      // Validate that deadline is before match date
      const matchDateTime = new Date(matchDate);
      const deadlineDateTime = new Date(deadline);

      if (deadlineDateTime >= matchDateTime) {
        return res.status(400).json({
          success: false,
          message: 'Deadline must be before match date'
        });
      }

      const fixture = await Fixture.create({
        homeTeam,
        awayTeam,
        matchDate: matchDateTime,
        deadline: deadlineDateTime,
        gameweek: parseInt(gameweek),
        status: FixtureStatus.UPCOMING // Use the enum value
      });

      return res.status(201).json({
        success: true,
        message: 'Fixture created successfully',
        data: fixture
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

  public async updateFixture(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Find the fixture first
      const fixture = await Fixture.findByPk(parseInt(id));
      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: 'Fixture not found'
        });
      }

      // If updating dates, validate them
      if (updateData.matchDate && updateData.deadline) {
        const matchDateTime = new Date(updateData.matchDate);
        const deadlineDateTime = new Date(updateData.deadline);

        if (deadlineDateTime >= matchDateTime) {
          return res.status(400).json({
            success: false,
            message: 'Deadline must be before match date'
          });
        }
      }

      // If updating status, validate it's a valid enum value
      if (updateData.status && !Object.values(FixtureStatus).includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${Object.values(FixtureStatus).join(', ')}`
        });
      }

      // Update the fixture
      await fixture.update(updateData);

      // If scores were updated, recalculate points
      if (updateData.homeScore !== undefined && updateData.awayScore !== undefined) {
        await Prediction.recalculateAllPoints();
      }

      return res.status(200).json({
        success: true,
        message: 'Fixture updated successfully',
        data: fixture
      });
    } catch (error) {
      console.error('Update fixture error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating fixture',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async deleteFixture(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // Find the fixture first
      const fixture = await Fixture.findByPk(parseInt(id));
      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: 'Fixture not found'
        });
      }

      // Check if fixture has predictions
      const predictionCount = await Prediction.count({
        where: { fixtureId: parseInt(id) }
      });

      if (predictionCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete fixture. It has ${predictionCount} prediction(s) associated with it.`
        });
      }

      // Delete the fixture
      await fixture.destroy();

      return res.status(200).json({
        success: true,
        message: 'Fixture deleted successfully'
      });
    } catch (error) {
      console.error('Delete fixture error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting fixture',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}