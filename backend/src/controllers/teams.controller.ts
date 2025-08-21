/* filepath: backend/src/controllers/teams.controller.ts */
import { Request, Response } from 'express';
import { Team } from '../models/Team';

export class TeamsController {
  // Get all teams
  async getAllTeams(req: Request, res: Response) {
    try {
      const teams = await Team.findAll({
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: teams
      });
    } catch (error: any) {
      console.error('Get all teams error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching teams',
        error: error.message
      });
    }
  }

  // Get team by ID
  async getTeamById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const team = await Team.findByPk(id);

      if (!team) {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }

      res.json({
        success: true,
        data: team
      });
    } catch (error: any) {
      console.error('Get team by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching team',
        error: error.message
      });
    }
  }
}

export const teamsController = new TeamsController();