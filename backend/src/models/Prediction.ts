import { pool } from '../config/database';

export class Prediction {
    id: number;
    userId: number;
    fixtureId: number;
    predictedHomeScore: number;
    predictedAwayScore: number;
    points: number;
    isDouble: boolean;
    createdAt: Date;
    updatedAt: Date;

    constructor(data: any) {
        this.id = data.id;
        this.userId = data.user_id;
        this.fixtureId = data.fixture_id;
        this.predictedHomeScore = data.predicted_home_score;
        this.predictedAwayScore = data.predicted_away_score;
        this.points = data.points;
        this.isDouble = data.is_double || false;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    static async createOrUpdate(data: any) {
        const { userId, fixtureId, homeScore, awayScore, isDouble } = data;
        
        // Check if prediction already exists
        const existingResult = await pool.query(
            'SELECT id FROM predictions WHERE user_id = $1 AND fixture_id = $2',
            [userId, fixtureId]
        );

        // If setting as double, remove any existing double for this gameweek
        if (isDouble) {
            await pool.query(`
                UPDATE predictions SET is_double = FALSE 
                WHERE user_id = $1 
                AND fixture_id IN (
                    SELECT id FROM fixtures 
                    WHERE gameweek = (SELECT gameweek FROM fixtures WHERE id = $2)
                )
            `, [userId, fixtureId]);
        }

        if (existingResult.rows.length > 0) {
            // Update existing prediction
            const result = await pool.query(
                'UPDATE predictions SET predicted_home_score = $1, predicted_away_score = $2, is_double = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 AND fixture_id = $5 RETURNING *',
                [homeScore, awayScore, isDouble || false, userId, fixtureId]
            );
            return new Prediction(result.rows[0]);
        } else {
            // Create new prediction
            const result = await pool.query(
                'INSERT INTO predictions (user_id, fixture_id, predicted_home_score, predicted_away_score, is_double) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [userId, fixtureId, homeScore, awayScore, isDouble || false]
            );
            return new Prediction(result.rows[0]);
        }
    }

    static async findByUserIdAndGameweek(userId: number, gameweek: number) {
        const result = await pool.query(
            `SELECT 
                p.*,
                f.home_team,
                f.away_team,
                f.match_date,
                f.deadline,
                f.home_score,
                f.away_score,
                f.status,
                f.gameweek
             FROM predictions p 
             JOIN fixtures f ON p.fixture_id = f.id 
             WHERE p.user_id = $1 AND f.gameweek = $2
             ORDER BY f.match_date ASC`,
            [userId, gameweek]
        );
        
        return result.rows.map(row => ({
            id: row.id,
            homeScore: row.predicted_home_score,
            awayScore: row.predicted_away_score,
            points: row.points,
            isDouble: row.is_double,
            fixture: {
                id: row.fixture_id,
                homeTeam: row.home_team,
                awayTeam: row.away_team,
                matchDate: row.match_date,
                deadline: row.deadline,
                homeScore: row.home_score,
                awayScore: row.away_score,
                status: row.status,
                gameweek: row.gameweek
            },
            createdAt: row.created_at
        }));
    }

    static async calculatePoints(predictionId: number) {
        const result = await pool.query(
            `SELECT 
                p.predicted_home_score,
                p.predicted_away_score,
                p.is_double,
                f.home_score,
                f.away_score,
                f.status
             FROM predictions p 
             JOIN fixtures f ON p.fixture_id = f.id 
             WHERE p.id = $1`,
            [predictionId]
        );

        if (result.rows.length === 0 || result.rows[0].status !== 'finished' || 
            result.rows[0].home_score === null || result.rows[0].away_score === null) {
            return 0;
        }

        const prediction = result.rows[0];
        const actualHomeScore = prediction.home_score;
        const actualAwayScore = prediction.away_score;
        const predictedHomeScore = prediction.predicted_home_score;
        const predictedAwayScore = prediction.predicted_away_score;
        const isDouble = prediction.is_double;

        let points = 0;

        // Determine actual result
        const actualResult = actualHomeScore > actualAwayScore ? 'home' : 
                           actualHomeScore < actualAwayScore ? 'away' : 'draw';
        
        // Determine predicted result
        const predictedResult = predictedHomeScore > predictedAwayScore ? 'home' : 
                              predictedHomeScore < predictedAwayScore ? 'away' : 'draw';

        // Points for correct result
        if (actualResult === predictedResult) {
            if (actualResult === 'draw') {
                points += 2; // Draw prediction correct
            } else {
                points += 1; // Win prediction correct
            }
        }

        // Points for correct goal difference
        const actualDifference = Math.abs(actualHomeScore - actualAwayScore);
        const predictedDifference = Math.abs(predictedHomeScore - predictedAwayScore);
        
        if (actualDifference === predictedDifference) {
            points += 2;
        }

        // Points for exact score
        if (actualHomeScore === predictedHomeScore && actualAwayScore === predictedAwayScore) {
            points += 4;
        }

        // Double the points if this is a double prediction
        if (isDouble) {
            points *= 2;
        }

        // Update points in database
        await pool.query(
            'UPDATE predictions SET points = $1 WHERE id = $2',
            [points, predictionId]
        );

        return points;
    }

    // Keep existing methods...
    static async findByUserId(userId: number) {
        const result = await pool.query(
            `SELECT 
                p.*,
                f.home_team,
                f.away_team,
                f.match_date,
                f.deadline,
                f.home_score,
                f.away_score,
                f.status,
                f.gameweek
             FROM predictions p 
             JOIN fixtures f ON p.fixture_id = f.id 
             WHERE p.user_id = $1 
             ORDER BY f.match_date DESC`,
            [userId]
        );
        
        return result.rows.map(row => ({
            id: row.id,
            homeScore: row.predicted_home_score,
            awayScore: row.predicted_away_score,
            points: row.points,
            isDouble: row.is_double,
            fixture: {
                id: row.fixture_id,
                homeTeam: row.home_team,
                awayTeam: row.away_team,
                matchDate: row.match_date,
                deadline: row.deadline,
                homeScore: row.home_score,
                awayScore: row.away_score,
                status: row.status,
                gameweek: row.gameweek
            },
            createdAt: row.created_at
        }));
    }

    static async findAll() {
        const result = await pool.query('SELECT * FROM predictions ORDER BY created_at DESC');
        return result.rows.map(row => new Prediction(row));
    }

    static async update(data: any, options: { where: { id: number } }) {
        const { id } = options.where;
        const { homeScore, awayScore } = data;
        const result = await pool.query(
            'UPDATE predictions SET predicted_home_score = $1, predicted_away_score = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [homeScore, awayScore, id]
        );
        return result.rows.length > 0 ? new Prediction(result.rows[0]) : null;
    }

    static async destroy(options: { where: { id: number } }) {
        const { id } = options.where;
        await pool.query('DELETE FROM predictions WHERE id = $1', [id]);
        return true;
    }

    static async recalculateAllPoints() {
        const predictions = await pool.query(
            `SELECT p.id FROM predictions p 
             JOIN fixtures f ON p.fixture_id = f.id 
             WHERE f.status = 'finished' AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL`
        );

        for (const prediction of predictions.rows) {
            await this.calculatePoints(prediction.id);
        }
    }

    static async getLeaderboard() {
        console.log('Getting leaderboard...');
        
        const result = await pool.query(`
            SELECT 
                u.id as user_id,
                u.username,
                COALESCE(SUM(CASE WHEN f.status = 'finished' THEN p.points ELSE 0 END), 0) as total_points,
                ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN f.status = 'finished' THEN p.points ELSE 0 END), 0) DESC) as rank
            FROM users u
            LEFT JOIN predictions p ON u.id = p.user_id
            LEFT JOIN fixtures f ON p.fixture_id = f.id
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
        `);
        
        console.log('Leaderboard query result:', result.rows);
        return result.rows;
    }
}