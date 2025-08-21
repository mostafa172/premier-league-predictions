/* filepath: backend/src/models/Prediction.ts */
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

interface PredictionAttributes {
  id: number;
  userId: number;
  fixtureId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points: number;
  isDouble: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PredictionCreationAttributes extends Optional<PredictionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Prediction extends Model<PredictionAttributes, PredictionCreationAttributes> implements PredictionAttributes {
  public id!: number;
  public userId!: number;
  public fixtureId!: number;
  public predictedHomeScore!: number;
  public predictedAwayScore!: number;
  public points!: number;
  public isDouble!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public fixture?: any;
  public user?: any;

  // Static method for points calculation
  public static calculatePoints(
    predictedHome: number,
    predictedAway: number,
    actualHome: number,
    actualAway: number,
    isDouble: boolean = false
  ): number {
    let points = 0;

    // Exact score = 3 points
    if (predictedHome === actualHome && predictedAway === actualAway) {
      points = 3;
    }
    // Correct result (win/draw/loss) = 1 point
    else if (
      (predictedHome > predictedAway && actualHome > actualAway) || // Both predict home win
      (predictedHome < predictedAway && actualHome < actualAway) || // Both predict away win
      (predictedHome === predictedAway && actualHome === actualAway) // Both predict draw
    ) {
      points = 1;
    }

    // Double the points if it's a double prediction
    return isDouble ? points * 2 : points;
  }

  // Static method to recalculate all points (for admin use)
  public static async recalculateAllPoints(): Promise<number> {
    try {
      const { Fixture } = require('./Fixture');
      
      // Get all finished fixtures with their predictions
      const predictions = await Prediction.findAll({
        include: [{
          model: Fixture,
          where: { status: 'finished' },
          required: true
        }]
      });

      let count = 0;
      for (const prediction of predictions) {
        const fixture = prediction.fixture;
        if (fixture.homeScore !== null && fixture.awayScore !== null) {
          const newPoints = Prediction.calculatePoints(
            prediction.predictedHomeScore,
            prediction.predictedAwayScore,
            fixture.homeScore,
            fixture.awayScore,
            prediction.isDouble
          );
          
          if (prediction.points !== newPoints) {
            prediction.points = newPoints;
            await prediction.save();
            count++;
          }
        }
      }

      return count;
    } catch (error) {
      console.error('Error recalculating points:', error);
      throw error;
    }
  }
}

Prediction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id', // Maps to snake_case in database
    },
    fixtureId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'fixture_id', // Maps to snake_case in database
    },
    predictedHomeScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'predicted_home_score',
    },
    predictedAwayScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'predicted_away_score',
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isDouble: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_double',
    },
  },
  {
    sequelize,
    modelName: 'Prediction',
    tableName: 'predictions',
    underscored: true, // This converts camelCase to snake_case automatically
  }
);