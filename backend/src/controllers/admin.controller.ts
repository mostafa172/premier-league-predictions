/* filepath: backend/src/controllers/admin.controller.ts */
import { Request, Response } from "express";
import { Fixture, FixtureStatus } from "../models/Fixture";
import { Prediction } from "../models/Prediction";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    isAdmin: boolean;
    is_admin: boolean;
  };
}

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
            model: Prediction,
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

  public async updateAllFixtureStatuses(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      // Check admin access
      if (!this.checkAdminAccess(req, res)) {
        return res; // Response already sent by checkAdminAccess
      }

      // Get all fixtures that might need status updates
      const fixtures = await Fixture.findAll({
        where: {
          status: [FixtureStatus.UPCOMING, FixtureStatus.LIVE],
        },
      });

      let updatedCount = 0;
      const now = new Date();

      for (const fixture of fixtures) {
        let needsUpdate = false;

        // Check if fixture should be marked as finished
        if (
          fixture.homeScore !== null &&
          fixture.awayScore !== null &&
          fixture.status !== FixtureStatus.FINISHED
        ) {
          fixture.status = FixtureStatus.FINISHED;
          needsUpdate = true;
        }
        // Check if fixture should be marked as live
        else if (
          fixture.matchDate <= now &&
          fixture.status === FixtureStatus.UPCOMING
        ) {
          fixture.status = FixtureStatus.LIVE;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await fixture.save();
          updatedCount++;
        }
      }

      return res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} fixture statuses`,
      });
    } catch (error) {
      console.error("Update fixture statuses error:", error);
      return res.status(500).json({
        success: false,
        message: "Error updating fixture statuses",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Recalculate all prediction points
  public async recalculatePoints(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      // Check admin access
      if (!this.checkAdminAccess(req, res)) {
        return res; // Response already sent by checkAdminAccess
      }

      const count = await Prediction.recalculateAllPoints();

      return res.status(200).json({
        success: true,
        message: `Recalculated points for ${count} predictions`,
        data: { count },
      });
    } catch (error) {
      console.error("Recalculate points error:", error);
      return res.status(500).json({
        success: false,
        message: "Error recalculating points",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const adminController = new AdminController();
