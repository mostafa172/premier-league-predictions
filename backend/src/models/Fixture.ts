/* filepath: backend/src/models/Fixture.ts */
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { Op } from 'sequelize';

// Export the FixtureStatus enum
export enum FixtureStatus {
  UPCOMING = 'upcoming',
  LIVE = 'live',
  FINISHED = 'finished'
}

interface FixtureAttributes {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  matchDate: Date;
  gameweek: number;
  status: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
  deadline: Date;
  externalId?: number | null;
  syncSource?: string | null;
  lastSyncedAt?: Date | null;
  resultVerifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FixtureCreationAttributes extends Optional<FixtureAttributes, 'id' | 'homeScore' | 'awayScore' | 'externalId' | 'syncSource' | 'lastSyncedAt' | 'resultVerifiedAt' | 'createdAt' | 'updatedAt'> {}

export class Fixture extends Model<FixtureAttributes, FixtureCreationAttributes> implements FixtureAttributes {
  public id!: number;
  public homeTeamId!: number;
  public awayTeamId!: number;
  public matchDate!: Date;
  public gameweek!: number;
  public status!: FixtureStatus;
  public homeScore?: number;
  public awayScore?: number;
  public deadline!: Date;
  public externalId?: number | null;
  public syncSource?: string | null;
  public lastSyncedAt?: Date | null;
  public resultVerifiedAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public homeTeam?: any;
  public awayTeam?: any;
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
          [Op.gte]: new Date()
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
    homeTeamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'home_team_id',
      references: {
        model: 'teams',
        key: 'id',
      },
    },
    awayTeamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'away_team_id',
      references: {
        model: 'teams',
        key: 'id',
      },
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
    externalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'external_id',
    },
    syncSource: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'sync_source',
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_synced_at',
    },
    resultVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'result_verified_at',
    },
  },
  {
    sequelize,
    modelName: 'Fixture',
    tableName: 'fixtures',
    underscored: true,
  }
);
