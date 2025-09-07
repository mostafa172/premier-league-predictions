import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

interface LeagueAttributes {
  id: number;
  name: string;
  description?: string;
  joinCode: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LeagueCreationAttributes extends Optional<LeagueAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class League extends Model<LeagueAttributes, LeagueCreationAttributes> implements LeagueAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public joinCode!: string;
  public createdBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations will be defined in associations.ts
}

League.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    joinCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      field: 'join_code',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'leagues',
    timestamps: true,
    underscored: true,
  }
);
