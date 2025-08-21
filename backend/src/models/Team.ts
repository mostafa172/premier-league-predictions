/* filepath: backend/src/models/Team.ts */
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

interface TeamAttributes {
  id: number;
  name: string;
  abbreviation: string;
  logoUrl?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  foundedYear?: number;
  stadium?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TeamCreationAttributes extends Optional<TeamAttributes, 'id' | 'logoUrl' | 'colorPrimary' | 'colorSecondary' | 'foundedYear' | 'stadium' | 'createdAt' | 'updatedAt'> {}

export class Team extends Model<TeamAttributes, TeamCreationAttributes> implements TeamAttributes {
  public id!: number;
  public name!: string;
  public abbreviation!: string;
  public logoUrl?: string;
  public colorPrimary?: string;
  public colorSecondary?: string;
  public foundedYear?: number;
  public stadium?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties - clear any existing ones
  public homeFixtures?: any[];
  public awayFixtures?: any[];

  // Static property to ensure we don't duplicate associations
  static associationsSetup = false;
}

Team.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    abbreviation: {
      type: DataTypes.STRING(5),
      allowNull: false,
      unique: true,
    },
    logoUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'logo_url',
    },
    colorPrimary: {
      type: DataTypes.STRING(7),
      allowNull: true,
      field: 'color_primary',
    },
    colorSecondary: {
      type: DataTypes.STRING(7),
      allowNull: true,
      field: 'color_secondary',
    },
    foundedYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'founded_year',
    },
    stadium: {
      type: DataTypes.STRING(100),
      allowNull: true,
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
    modelName: 'Team',
    tableName: 'teams',
    underscored: true,
    timestamps: true,
  }
);