import { Request, Response } from 'express';
import { Prediction } from '../models/Prediction';
import { Fixture, FixtureStatus } from '../models/Fixture';

export class AdminController {
    public async recalculateAllPoints(req: Request, res: Response): Promise<Response> {
        try {
            const count = await Prediction.recalculateAllPoints();
            return res.status(200).json({
                success: true,
                message: `Points recalculated for ${count} predictions`
            });
        } catch (error) {
            console.error('Recalculate points error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error recalculating points', 
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    public async updateAllFixtureStatuses(req: Request, res: Response): Promise<Response> {
        try {
            // Get all fixtures that might need status updates
            const fixtures = await Fixture.findAll({
                where: {
                    status: [FixtureStatus.UPCOMING, FixtureStatus.LIVE]
                }
            });

            let updatedCount = 0;
            const now = new Date();

            for (const fixture of fixtures) {
                let needsUpdate = false;
                
                // Check if fixture should be marked as finished
                if (fixture.homeScore !== null && fixture.awayScore !== null && 
                    fixture.status !== FixtureStatus.FINISHED) {
                    fixture.status = FixtureStatus.FINISHED;
                    needsUpdate = true;
                }
                // Check if fixture should be marked as live
                else if (fixture.matchDate <= now && fixture.status === FixtureStatus.UPCOMING) {
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
                message: `Updated ${updatedCount} fixture statuses`
            });
        } catch (error) {
            console.error('Update fixture statuses error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error updating fixture statuses', 
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}