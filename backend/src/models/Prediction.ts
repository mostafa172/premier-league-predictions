/* filepath: backend/src/models/Prediction.ts */
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { FixtureStatus } from './Fixture'; // Import enum

interface PredictionAttributes {
  id: number;
  userId: number;
  fixtureId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points: number;
  isDouble: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PredictionCreationAttributes extends Optional<PredictionAttributes, 'id' | 'points' | 'isDouble' | 'createdAt' | 'updatedAt'> {}

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

  // Static method to calculate points for a single prediction
  public static calculatePoints(
    predictedHome: number,
    predictedAway: number,
    actualHome: number,
    actualAway: number,
    isDouble: boolean = false
  ): number {
    let points = 0;

    // Exact score prediction (5 points)
    if (predictedHome === actualHome && predictedAway === actualAway) {
      points = 5;
    }
    // Correct goal difference (3 points)
    else if ((predictedHome - predictedAway) === (actualHome - actualAway)) {
      points = 3;
    }
    // Correct result (win/draw/loss) (1 point)
    else if (
      (predictedHome > predictedAway && actualHome > actualAway) || // Both home wins
      (predictedHome < predictedAway && actualHome < actualAway) || // Both away wins
      (predictedHome === predictedAway && actualHome === actualAway) // Both draws
    ) {
      points = 1;
    }

    // Double points if selected
    if (isDouble) {
      points *= 2;
    }

    return points;
  }

  // Static method to recalculate all prediction points
  public static async recalculateAllPoints(): Promise<number> {
    try {
      console.log('🔄 Starting to recalculate all prediction points...');

      // Get all predictions with their fixture results (using proper enum)
      const predictions = await Prediction.findAll({
        include: [
          {
            model: sequelize.models.Fixture,
            as: 'fixture',
            where: {
              status: FixtureStatus.FINISHED // Use enum instead of string
            },
            attributes: ['id', 'homeScore', 'awayScore', 'status']
          }
        ]
      });

      console.log(`📊 Found ${predictions.length} predictions to recalculate`);

      let updatedCount = 0;

      // Process predictions in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < predictions.length; i += batchSize) {
        const batch = predictions.slice(i, i + batchSize);
        
        const updatePromises = batch.map(async (prediction: any) => {
          const fixture = prediction.fixture;
          
          if (fixture && fixture.homeScore !== null && fixture.awayScore !== null) {
            const calculatedPoints = Prediction.calculatePoints(
              prediction.predictedHomeScore,
              prediction.predictedAwayScore,
              fixture.homeScore,
              fixture.awayScore,
              prediction.isDouble
            );

            // Only update if points have changed
            if (prediction.points !== calculatedPoints) {
              await prediction.update({ points: calculatedPoints });
              updatedCount++;
            }
          }
        });

        await Promise.all(updatePromises);
        console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(predictions.length / batchSize)}`);
      }

      console.log(`🎯 Recalculation complete! Updated ${updatedCount} predictions`);
      return updatedCount;

    } catch (error) {
      console.error('❌ Error recalculating prediction points:', error);
      throw error;
    }
  }

  // Instance method to calculate and update points for this prediction
  public async calculateAndUpdatePoints(): Promise<void> {
    try {
      // Load the fixture if not already loaded
      if (!this.fixture) {
        await this.reload({
          include: [
            {
              model: sequelize.models.Fixture,
              as: 'fixture'
            }
          ]
        });
      }

      const fixture = this.fixture;
      
      if (fixture && fixture.status === FixtureStatus.FINISHED && // Use enum
          fixture.homeScore !== null && fixture.awayScore !== null) {
        
        const calculatedPoints = Prediction.calculatePoints(
          this.predictedHomeScore,
          this.predictedAwayScore,
          fixture.homeScore,
          fixture.awayScore,
          this.isDouble
        );

        if (this.points !== calculatedPoints) {
          await this.update({ points: calculatedPoints });
        }
      }
    } catch (error) {
      console.error('Error calculating points for prediction:', error);
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
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    fixtureId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'fixture_id',
      references: {
        model: 'fixtures',
        key: 'id',
      },
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    modelName: 'Prediction',
    tableName: 'predictions',
    underscored: true,
    timestamps: true,
  }
);