import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize';

export enum SyncJob {
  SCHEDULE = 'schedule',
  /** Settles finished matches. Named for results, not live play. */
  RESULTS = 'results',
  RECONCILE = 'reconcile',
  TEAMS = 'teams',
}

export enum SyncRunStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

interface SyncRunAttributes {
  id: number;
  job: SyncJob;
  provider: string;
  competition: string;
  status: SyncRunStatus;
  dryRun: boolean;
  fixturesCreated: number;
  fixturesUpdated: number;
  fixturesSkipped: number;
  predictionsScored: number;
  apiRequests: number;
  warnings: string[];
  error?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SyncRunCreationAttributes
  extends Optional<
    SyncRunAttributes,
    | 'id'
    | 'status'
    | 'dryRun'
    | 'fixturesCreated'
    | 'fixturesUpdated'
    | 'fixturesSkipped'
    | 'predictionsScored'
    | 'apiRequests'
    | 'warnings'
    | 'error'
    | 'startedAt'
    | 'finishedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

export class SyncRun
  extends Model<SyncRunAttributes, SyncRunCreationAttributes>
  implements SyncRunAttributes
{
  public id!: number;
  public job!: SyncJob;
  public provider!: string;
  public competition!: string;
  public status!: SyncRunStatus;
  public dryRun!: boolean;
  public fixturesCreated!: number;
  public fixturesUpdated!: number;
  public fixturesSkipped!: number;
  public predictionsScored!: number;
  public apiRequests!: number;
  public warnings!: string[];
  public error?: string | null;
  public startedAt!: Date;
  public finishedAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SyncRun.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    job: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    competition: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: SyncRunStatus.RUNNING,
    },
    dryRun: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'dry_run',
    },
    fixturesCreated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'fixtures_created',
    },
    fixturesUpdated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'fixtures_updated',
    },
    fixturesSkipped: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'fixtures_skipped',
    },
    predictionsScored: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'predictions_scored',
    },
    apiRequests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'api_requests',
    },
    warnings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'started_at',
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finished_at',
    },
  },
  {
    sequelize,
    modelName: 'SyncRun',
    tableName: 'sync_runs',
    underscored: true,
    timestamps: true,
  }
);
