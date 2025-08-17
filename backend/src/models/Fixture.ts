import { pool } from '../config/database';

export class Fixture {
    id: number;
    homeTeam: string;
    awayTeam: string;
    matchDate: Date;
    deadline: Date;
    homeScore?: number;
    awayScore?: number;
    status: string;
    gameweek: number;
    createdAt: Date;
    updatedAt: Date;

    constructor(data: any) {
        this.id = data.id;
        this.homeTeam = data.home_team;
        this.awayTeam = data.away_team;
        this.matchDate = data.match_date;
        this.deadline = data.deadline;
        this.homeScore = data.home_score;
        this.awayScore = data.away_score;
        this.status = data.status || 'upcoming';
        this.gameweek = data.gameweek;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    static async updateStatuses() {
        const now = new Date();
        
        // Update to 'live' if match has started but not finished
        await pool.query(`
            UPDATE fixtures 
            SET status = 'live' 
            WHERE match_date <= $1 
            AND status = 'upcoming'
            AND (home_score IS NULL OR away_score IS NULL)
        `, [now]);
    
        // Update to 'finished' if scores are set
        await pool.query(`
            UPDATE fixtures 
            SET status = 'finished' 
            WHERE home_score IS NOT NULL 
            AND away_score IS NOT NULL 
            AND status IN ('upcoming', 'live')
        `);
    
        // Recalculate points for newly finished matches
        const { Prediction } = await import('./Prediction');
        await Prediction.recalculateAllPoints();
    }

    static async create(data: any) {
        const { homeTeam, awayTeam, matchDate, deadline, gameweek } = data;
        const result = await pool.query(
            'INSERT INTO fixtures (home_team, away_team, match_date, deadline, gameweek) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [homeTeam, awayTeam, matchDate, deadline, gameweek || 1]
        );
        return new Fixture(result.rows[0]);
    }

    static async findAll() {
        await this.updateStatuses(); // Update statuses before fetching
        const result = await pool.query('SELECT * FROM fixtures ORDER BY match_date ASC');
        return result.rows.map(row => new Fixture(row));
    }

    static async findByGameweek(gameweek: number) {
        await this.updateStatuses(); // Update statuses before fetching
        const result = await pool.query(
            'SELECT * FROM fixtures WHERE gameweek = $1 ORDER BY match_date ASC',
            [gameweek]
        );
        return result.rows.map(row => new Fixture(row));
    }

    static async findById(id: number) {
        const result = await pool.query('SELECT * FROM fixtures WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        return new Fixture(result.rows[0]);
    }

    static async findUpcoming() {
        await this.updateStatuses();
        const result = await pool.query(
            'SELECT * FROM fixtures WHERE status IN (\'upcoming\', \'live\') ORDER BY match_date ASC'
        );
        return result.rows.map(row => new Fixture(row));
    }

    static async update(data: any, options: { where: { id: number } }) {
        const { id } = options.where;
        const fields = [];
        const values = [];
        let paramCount = 1;

        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                fields.push(`${dbKey} = $${paramCount}`);
                values.push(data[key]);
                paramCount++;
            }
        });

        if (fields.length === 0) return null;

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query = `UPDATE fixtures SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await pool.query(query, values);
        
        if (result.rows.length > 0) {
            const fixture = new Fixture(result.rows[0]);
            // Auto-update status if scores were added
            if (data.homeScore !== undefined && data.awayScore !== undefined) {
                await this.updateStatuses();
            }
            return fixture;
        }
        return null;
    }

    static async destroy(options: { where: { id: number } }) {
        const { id } = options.where;
        await pool.query('DELETE FROM fixtures WHERE id = $1', [id]);
        return true;
    }
}