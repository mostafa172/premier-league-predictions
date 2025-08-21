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

  // Association properties
  public homeFixtures?: any[];
  public awayFixtures?: any[];
}

Team.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    abbreviation: {
      type: DataTypes.STRING(3),
      allowNull: false,
      unique: true,
    },
    logoUrl: {
      type: DataTypes.STRING,
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
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Team',
    tableName: 'teams',
    underscored: true,
  }
);