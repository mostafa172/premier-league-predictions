import { Request, Response } from 'express';
import { Prediction } from '../models/Prediction';
import { Fixture } from '../models/Fixture';

export class AdminController {
    public async recalculateAllPoints(req: Request, res: Response): Promise<Response> {
        try {
            await Prediction.recalculateAllPoints();
            return res.status(200).json({
                success: true,
                message: 'All points recalculated successfully'
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error recalculating points', 
                error 
            });
        }
    }

    public async updateAllFixtureStatuses(req: Request, res: Response): Promise<Response> {
        try {
            await Fixture.updateStatuses();
            return res.status(200).json({
                success: true,
                message: 'All fixture statuses updated successfully'
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error updating fixture statuses', 
                error 
            });
        }
    }
}