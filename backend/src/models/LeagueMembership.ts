import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

interface LeagueMembershipAttributes {
  id: number;
  leagueId: number;
  userId: number;
  joinedAt: Date;
}

interface LeagueMembershipCreationAttributes extends Optional<LeagueMembershipAttributes, 'id' | 'joinedAt'> {}

export class LeagueMembership extends Model<LeagueMembershipAttributes, LeagueMembershipCreationAttributes> implements LeagueMembershipAttributes {
  public id!: number;
  public leagueId!: number;
  public userId!: number;
  public readonly joinedAt!: Date;

  // Associations will be defined in associations.ts
}

LeagueMembership.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    leagueId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'league_id',
      references: {
        model: 'leagues',
        key: 'id',
      },
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
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'joined_at',
    },
  },
  {
    sequelize,
    tableName: 'league_memberships',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['league_id', 'user_id'],
      },
    ],
  }
);
