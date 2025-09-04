import { Request, Response } from 'express';
import { League, LeagueMembership, User, sequelize } from '../models';
import { QueryTypes } from 'sequelize';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

export class LeaguesController {
  // Generate a unique join code
  private generateJoinCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create a new league
  public async createLeague(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { name, description } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'League name is required' });
      }

      // Generate unique join code
      let joinCode: string;
      let isUnique = false;
      let attempts = 0;
      
      do {
        joinCode = this.generateJoinCode();
        const existingLeague = await League.findOne({ where: { joinCode } });
        isUnique = !existingLeague;
        attempts++;
      } while (!isUnique && attempts < 10);

      if (!isUnique) {
        return res.status(500).json({ success: false, message: 'Failed to generate unique join code' });
      }

      const league = await League.create({
        name: name.trim(),
        description: description?.trim() || null,
        joinCode,
        createdBy: userId,
      });

      // Add creator as a member
      await LeagueMembership.create({
        leagueId: league.id,
        userId: userId,
      });

      return res.status(201).json({
        success: true,
        data: league,
        message: 'League created successfully'
      });
    } catch (error) {
      console.error('Error creating league:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get all leagues with member count
  public async getAllLeagues(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const leagues = await sequelize.query(`
        SELECT 
          l.id,
          l.name,
          l.description,
          l.join_code as "joinCode",
          l.created_by as "createdBy",
          l.created_at as "createdAt",
          COUNT(lm.id) as "memberCount",
          u.username as "creatorUsername"
        FROM leagues l
        LEFT JOIN league_memberships lm ON l.id = lm.league_id
        LEFT JOIN users u ON l.created_by = u.id
        GROUP BY l.id, l.name, l.description, l.join_code, l.created_by, l.created_at, u.username
        ORDER BY l.created_at DESC
      `, {
        type: QueryTypes.SELECT
      });

      return res.status(200).json({
        success: true,
        data: leagues
      });
    } catch (error) {
      console.error('Error fetching leagues:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get user's leagues
  public async getUserLeagues(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const userLeagues = await sequelize.query(`
        SELECT 
          l.id,
          l.name,
          l.description,
          l.join_code as "joinCode",
          l.created_by as "createdBy",
          l.created_at as "createdAt",
          lm.joined_at as "joinedAt",
          COUNT(lm2.id) as "memberCount",
          u.username as "creatorUsername",
          CASE WHEN l.created_by = :userId THEN 1 ELSE 0 END as "isCreator"
        FROM leagues l
        INNER JOIN league_memberships lm ON l.id = lm.league_id
        LEFT JOIN league_memberships lm2 ON l.id = lm2.league_id
        LEFT JOIN users u ON l.created_by = u.id
        WHERE lm.user_id = :userId
        GROUP BY l.id, l.name, l.description, l.join_code, l.created_by, l.created_at, lm.joined_at, u.username
        ORDER BY lm.joined_at DESC
      `, {
        replacements: { userId },
        type: QueryTypes.SELECT
      });

      return res.status(200).json({
        success: true,
        data: userLeagues
      });
    } catch (error) {
      console.error('Error fetching user leagues:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Join a league by join code
  public async joinLeague(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { joinCode } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!joinCode || joinCode.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Join code is required' });
      }

      const league = await League.findOne({ where: { joinCode: joinCode.trim().toUpperCase() } });

      if (!league) {
        return res.status(404).json({ success: false, message: 'League not found' });
      }

      // Check if user is already a member
      const existingMembership = await LeagueMembership.findOne({
        where: { leagueId: league.id, userId }
      });

      if (existingMembership) {
        return res.status(400).json({ success: false, message: 'You are already a member of this league' });
      }

      // Add user to league
      await LeagueMembership.create({
        leagueId: league.id,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: { leagueId: league.id, leagueName: league.name },
        message: 'Successfully joined the league'
      });
    } catch (error) {
      console.error('Error joining league:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Leave a league
  public async leaveLeague(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const league = await League.findByPk(leagueId);

      if (!league) {
        return res.status(404).json({ success: false, message: 'League not found' });
      }

      // Check if user is the creator
      if (league.createdBy === userId) {
        return res.status(400).json({ success: false, message: 'League creator cannot leave the league' });
      }

      // Remove user from league
      const membership = await LeagueMembership.findOne({
        where: { leagueId: parseInt(leagueId), userId }
      });

      if (!membership) {
        return res.status(400).json({ success: false, message: 'You are not a member of this league' });
      }

      await membership.destroy();

      return res.status(200).json({
        success: true,
        message: 'Successfully left the league'
      });
    } catch (error) {
      console.error('Error leaving league:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get league details with members
  public async getLeagueDetails(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Check if user is a member of the league (optional - allow viewing for non-members)
      const membership = await LeagueMembership.findOne({
        where: { leagueId: parseInt(leagueId), userId }
      });

      // Get league details
      const league = await League.findByPk(leagueId, {
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username']
          }
        ]
      });

      if (!league) {
        return res.status(404).json({ success: false, message: 'League not found' });
      }

      // Get league members with their total points
      const members = await sequelize.query(`
        SELECT 
          u.id,
          u.username,
          lm.joined_at as "joinedAt",
          COALESCE(SUM(p.points), 0) as "totalPoints",
          CASE WHEN l.created_by = u.id THEN 1 ELSE 0 END as "isCreator"
        FROM league_memberships lm
        INNER JOIN users u ON lm.user_id = u.id
        INNER JOIN leagues l ON lm.league_id = l.id
        LEFT JOIN predictions p ON u.id = p.user_id
        LEFT JOIN fixtures f ON p.fixture_id = f.id
        WHERE lm.league_id = :leagueId
        GROUP BY u.id, u.username, lm.joined_at, l.created_by
        ORDER BY "totalPoints" DESC, u.username ASC
      `, {
        replacements: { leagueId: parseInt(leagueId) },
        type: QueryTypes.SELECT
      });

      return res.status(200).json({
        success: true,
        data: {
          league,
          members
        }
      });
    } catch (error) {
      console.error('Error fetching league details:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export const leaguesController = new LeaguesController();
