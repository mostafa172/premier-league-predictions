/* filepath: backend/src/controllers/admin.controller.ts */
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { User } from '../models/User';
import { Fixture, FixtureStatus } from '../models/Fixture'; // Import FixtureStatus enum
import { Prediction } from '../models/Prediction';
import { Team } from '../models/Team';
import { Op } from 'sequelize';

export class AdminController {
  
  // Helper method to check admin status
  private checkAdminAccess(req: AuthenticatedRequest, res: Response): boolean {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return false;
    }

    const isAdmin = req.user.isAdmin || req.user.is_admin;
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
      return false;
    }

    return true;
  }

  // Get all fixtures with prediction counts
  public async getAllFixtures(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      // Check admin access
      if (!this.checkAdminAccess(req, res)) {
        return res; // Response already sent by checkAdminAccess
      }

      const fixtures = await Fixture.findAll({
        order: [["matchDate", "ASC"]],
        include: [
          {
            model: Team,
            as: 'homeTeam',
            attributes: ['id', 'name', 'abbreviation']
          },
          {
            model: Team,
            as: 'awayTeam',
            attributes: ['id', 'name', 'abbreviation']
          },
          {
            model: Prediction,
            as: 'predictions',
            required: false,
            attributes: ["id"],
          },
        ],
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

  // Get all users (admin only)
  public async getUsers(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!this.checkAdminAccess(req, res)) {
        return res;
      }

      const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'isAdmin', 'createdAt'],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get users error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching users'
      });
    }
  }

  // Update fixture results (admin only)
  public async updateFixtureResult(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!this.checkAdminAccess(req, res)) {
        return res;
      }

      const { fixtureId } = req.params;
      const { homeScore, awayScore, status } = req.body;

      const fixture = await Fixture.findByPk(fixtureId);
      if (!fixture) {
        return res.status(404).json({
          success: false,
          message: 'Fixture not found'
        });
      }

      // Validate status if provided
      let validStatus = status;
      if (status && !Object.values(FixtureStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid fixture status'
        });
      }

      // Update fixture with proper enum value
      await fixture.update({
        homeScore,
        awayScore,
        status: validStatus || FixtureStatus.FINISHED
      });

      // Recalculate points for all predictions for this fixture
      const predictions = await Prediction.findAll({
        where: { fixtureId },
        include: [
          {
            model: Fixture,
            as: 'fixture'
          }
        ]
      });

      let updatedPredictions = 0;
      for (const prediction of predictions) {
        await prediction.calculateAndUpdatePoints();
        updatedPredictions++;
      }

      return res.status(200).json({
        success: true,
        message: `Fixture updated and ${updatedPredictions} predictions recalculated`,
        data: fixture
      });

    } catch (error) {
      console.error('Update fixture result error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating fixture result'
      });
    }
  }

  // Update all fixture statuses based on current time
  public async updateAllFixtureStatuses(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      if (!this.checkAdminAccess(req, res)) {
        return res;
      }

      const now = new Date();
      let updatedCount = 0;

      // Update fixtures that should be live (using proper enum values)
      const fixturesToLive = await Fixture.findAll({
        where: {
          status: FixtureStatus.UPCOMING, // Use enum instead of string
          matchDate: {
            [Op.lte]: now
          }
        }
      });

      for (const fixture of fixturesToLive) {
        await fixture.update({ status: FixtureStatus.LIVE }); // Use enum instead of string
        updatedCount++;
      }

      return res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} fixture statuses`,
        data: { updatedCount }
      });

    } catch (error) {
      console.error('Update fixture statuses error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating fixture statuses'
      });
    }
  }

  // Recalculate all prediction points
  public async recalculatePoints(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      // Check admin access
      if (!this.checkAdminAccess(req, res)) {
        return res; // Response already sent by checkAdminAccess
      }

      console.log('🚀 Admin requested points recalculation');
      
      const count = await Prediction.recalculateAllPoints();

      return res.status(200).json({
        success: true,
        message: `Successfully recalculated points for ${count} predictions`,
        data: { 
          updatedCount: count,
          timestamp: new Date().toISOString()
        },
      });
    } catch (error) {
      console.error("❌ Recalculate points error:", error);
      return res.status(500).json({
        success: false,
        message: "Error recalculating points",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get system statistics (admin only)
  public async getSystemStats(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!this.checkAdminAccess(req, res)) {
        return res;
      }

      const [
        totalUsers,
        totalPredictions,
        totalFixtures,
        finishedFixtures
      ] = await Promise.all([
        User.count(),
        Prediction.count(),
        Fixture.count(),
        Fixture.count({ where: { status: FixtureStatus.FINISHED } }) // Use enum
      ]);

      const stats = {
        totalUsers,
        totalPredictions,
        totalFixtures,
        finishedFixtures,
        upcomingFixtures: totalFixtures - finishedFixtures,
        timestamp: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Get system stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching system statistics'
      });
    }
  }

  // Delete user (admin only)
  public async deleteUser(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!this.checkAdminAccess(req, res)) {
        return res;
      }

      const { userId } = req.params;

      // Don't allow deletion of admin user's own account
      if (parseInt(userId) === req.user?.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.destroy();

      return res.status(200).json({
        success: true,
        message: `User ${user.username} deleted successfully`
      });

    } catch (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting user'
      });
    }
  }

  // Promote user to admin (admin only)
  public async promoteUser(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      if (!this.checkAdminAccess(req, res)) {
        return res;
      }

      const { userId } = req.params;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isAdmin) {
        return res.status(400).json({
          success: false,
          message: 'User is already an admin'
        });
      }

      await user.update({ isAdmin: true });

      return res.status(200).json({
        success: true,
        message: `User ${user.username} promoted to admin`,
        data: user
      });

    } catch (error) {
      console.error('Promote user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error promoting user'
      });
    }
  }
}

export const adminController = new AdminController();