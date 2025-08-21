/* filepath: backend/src/models/Fixture.ts */
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Export the FixtureStatus enum
export enum FixtureStatus {
  UPCOMING = 'upcoming',
  LIVE = 'live',
  FINISHED = 'finished'
}

interface FixtureAttributes {
  id: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  gameweek: number;
  status: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
  deadline: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FixtureCreationAttributes extends Optional<FixtureAttributes, 'id' | 'homeScore' | 'awayScore' | 'createdAt' | 'updatedAt'> {}

export class Fixture extends Model<FixtureAttributes, FixtureCreationAttributes> implements FixtureAttributes {
  public id!: number;
  public homeTeam!: string;
  public awayTeam!: string;
  public matchDate!: Date;
  public gameweek!: number;
  public status!: FixtureStatus;
  public homeScore?: number;
  public awayScore?: number;
  public deadline!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public predictions?: any[];

  // Static method to find fixtures by gameweek
  public static async findByGameweek(gameweek: number): Promise<Fixture[]> {
    return this.findAll({
      where: { gameweek },
      order: [['matchDate', 'ASC']]
    });
  }

  // Static method to find upcoming fixtures
  public static async findUpcoming(): Promise<Fixture[]> {
    return this.findAll({
      where: { 
        status: FixtureStatus.UPCOMING,
        matchDate: {
          [require('sequelize').Op.gte]: new Date()
        }
      },
      order: [['matchDate', 'ASC']]
    });
  }

  // Static method to find live fixtures
  public static async findLive(): Promise<Fixture[]> {
    return this.findAll({
      where: { status: FixtureStatus.LIVE },
      order: [['matchDate', 'ASC']]
    });
  }

  // Static method to find finished fixtures
  public static async findFinished(): Promise<Fixture[]> {
    return this.findAll({
      where: { status: FixtureStatus.FINISHED },
      order: [['matchDate', 'DESC']]
    });
  }
}

Fixture.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    homeTeam: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'home_team',
    },
    awayTeam: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'away_team',
    },
    matchDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'match_date',
    },
    gameweek: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(FixtureStatus.UPCOMING, FixtureStatus.LIVE, FixtureStatus.FINISHED),
      defaultValue: FixtureStatus.UPCOMING,
    },
    homeScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'home_score',
    },
    awayScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'away_score',
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Fixture',
    tableName: 'fixtures',
    underscored: true,
  }
);