import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

/** One previous meeting, using our team ids rather than provider ones. */
export interface H2HMeeting {
  /** ISO date of the kickoff, day precision is all the UI shows. */
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
}

interface HeadToHeadAttributes {
  id: number;
  teamAId: number;
  teamBId: number;
  provider: string;
  matches: H2HMeeting[];
  fetchedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface HeadToHeadCreationAttributes
  extends Optional<
    HeadToHeadAttributes,
    'id' | 'fetchedAt' | 'createdAt' | 'updatedAt'
  > {}

export class HeadToHead
  extends Model<HeadToHeadAttributes, HeadToHeadCreationAttributes>
  implements HeadToHeadAttributes
{
  public id!: number;
  public teamAId!: number;
  public teamBId!: number;
  public provider!: string;
  public matches!: H2HMeeting[];
  public fetchedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

HeadToHead.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    teamAId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'team_a_id',
      // Declared so upsert knows the conflict target is the pair, not the id.
      unique: 'head_to_head_pair',
    },
    teamBId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'team_b_id',
      unique: 'head_to_head_pair',
    },
    provider: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    matches: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    fetchedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'fetched_at',
      defaultValue: DataTypes.NOW,
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
    modelName: 'HeadToHead',
    tableName: 'head_to_head',
    underscored: true,
    timestamps: true,
  }
);

/** Canonical key for an unordered pair, matching the table's CHECK. */
export const pairKey = (
  teamOne: number,
  teamTwo: number
): { teamAId: number; teamBId: number } =>
  teamOne < teamTwo
    ? { teamAId: teamOne, teamBId: teamTwo }
    : { teamAId: teamTwo, teamBId: teamOne };
