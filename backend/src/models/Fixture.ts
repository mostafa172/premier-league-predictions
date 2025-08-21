import { Table, Column, Model, DataType, HasMany, BeforeUpdate, BeforeCreate } from 'sequelize-typescript';
import { Prediction } from './Prediction';
import { FixtureCreationAttributes } from '../interfaces/fixture.interface';

export enum FixtureStatus {
  UPCOMING = 'upcoming',
  LIVE = 'live',
  FINISHED = 'finished'
}

@Table({
  tableName: 'fixtures',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['home_team']
    },
    {
      fields: ['away_team']
    },
    {
      fields: ['match_date']
    },
    {
      fields: ['status']
    },
    {
      fields: ['gameweek']
    }
  ]
})
export class Fixture extends Model<Fixture, FixtureCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true
  })
  id!: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'home_team'
  })
  homeTeam!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'away_team'
  })
  awayTeam!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'match_date'
  })
  matchDate!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  deadline!: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'home_score'
  })
  homeScore?: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'away_score'
  })
  awayScore?: number;

  @Column({
    type: DataType.ENUM(...Object.values(FixtureStatus)),
    defaultValue: FixtureStatus.UPCOMING
  })
  status!: FixtureStatus;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1
  })
  gameweek!: number;

  @HasMany(() => Prediction)
  predictions!: Prediction[];

  // Auto-update status based on scores and time
  @BeforeUpdate
  @BeforeCreate
  static async updateStatus(instance: Fixture) {
    const now = new Date();
    
    if (instance.homeScore !== null && instance.awayScore !== null) {
      instance.status = FixtureStatus.FINISHED;
    } else if (instance.matchDate <= now && instance.status === FixtureStatus.UPCOMING) {
      instance.status = FixtureStatus.LIVE;
    }
  }

  // Static methods for common queries
  static async findByGameweek(gameweek: number) {
    return this.findAll({
      where: { gameweek },
      order: [['matchDate', 'ASC']],
      include: [{
        model: Prediction,
        required: false
      }]
    });
  }

  static async findUpcoming() {
    return this.findAll({
      where: {
        status: [FixtureStatus.UPCOMING, FixtureStatus.LIVE]
      },
      order: [['matchDate', 'ASC']]
    });
  }

  static async findFinished() {
    return this.findAll({
      where: { status: FixtureStatus.FINISHED },
      order: [['matchDate', 'DESC']]
    });
  }
}