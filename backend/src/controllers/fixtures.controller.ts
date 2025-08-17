import { Request, Response } from 'express';
import { Fixture } from '../models/Fixture';

export class FixturesController {
    public async getAllFixtures(req: Request, res: Response): Promise<Response> {
        try {
            const fixtures = await Fixture.findAll();
            return res.status(200).json({
                success: true,
                data: fixtures
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching fixtures', 
                error 
            });
        }
    }

    public async getFixturesByGameweek(req: Request, res: Response): Promise<Response> {
        const { gameweek } = req.params;
        try {
            const fixtures = await Fixture.findByGameweek(parseInt(gameweek));
            return res.status(200).json({
                success: true,
                data: fixtures
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching fixtures by gameweek', 
                error 
            });
        }
    }

    public async getFixtureById(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        try {
            const fixture = await Fixture.findById(parseInt(id));
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
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching fixture', 
                error 
            });
        }
    }

    public async createFixture(req: Request, res: Response): Promise<Response> {
        try {
            const newFixture = await Fixture.create(req.body);
            return res.status(201).json({
                success: true,
                message: 'Fixture created successfully',
                data: newFixture
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error creating fixture', 
                error 
            });
        }
    }

    public async updateFixture(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        try {
            const updatedFixture = await Fixture.update(req.body, { where: { id: parseInt(id) } });
            return res.status(200).json({
                success: true,
                message: 'Fixture updated successfully',
                data: updatedFixture
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error updating fixture', 
                error 
            });
        }
    }

    public async deleteFixture(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        try {
            await Fixture.destroy({ where: { id: parseInt(id) } });
            return res.status(200).json({
                success: true,
                message: 'Fixture deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error deleting fixture', 
                error 
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
            return res.status(500).json({ 
                success: false, 
                message: 'Error fetching upcoming fixtures', 
                error 
            });
        }
    }
}