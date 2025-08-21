/* filepath: backend/src/app.ts */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDatabase } from './config/sequelize';
// Remove setupAssociations import if it exists
import authRoutes from './routes/auth.routes';
import predictionsRoutes from './routes/predictions.routes';
import fixturesRoutes from './routes/fixtures.routes';
import adminRoutes from './routes/admin.routes';
import teamsRoutes from './routes/teams.routes';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/fixtures', fixturesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teams', teamsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Premier League Predictions API is running with Sequelize!',
        timestamp: new Date().toISOString() 
    });
});

// Initialize database and start server
const startServer = async () => {
    try {
        await connectDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();