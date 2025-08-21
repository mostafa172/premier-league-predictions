import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  BeforeCreate,
  BeforeUpdate,
} from "sequelize-typescript";
import { User } from "./User";
import { Fixture } from "./Fixture";
import { Op, fn, col, literal } from "sequelize";
import { PredictionCreationAttributes } from "../interfaces/prediction.interface";

interface PredictionInstance
  extends Model<PredictionInstance, PredictionCreationAttributes> {
  id: number;
  userId: number;
  fixtureId: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points: number;
  isDouble: boolean;
  user?: User;
  fixture?: Fixture;
}

@Table({
  tableName: "predictions",
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ["user_id", "fixture_id"],
    },
    {
      fields: ["user_id"],
    },
    {
      fields: ["fixture_id"],
    },
  ],
})
export class Prediction extends Model<
  Prediction,
  PredictionCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "user_id",
  })
  userId!: number;

  @ForeignKey(() => Fixture)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "fixture_id",
  })
  fixtureId!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "predicted_home_score",
  })
  predictedHomeScore!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "predicted_away_score",
  })
  predictedAwayScore!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  points!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: "is_double",
  })
  isDouble!: boolean;

  @BelongsTo(() => User)
  user!: User;

  @BelongsTo(() => Fixture)
  fixture!: Fixture;

  // Ensure only one double per gameweek per user
  @BeforeCreate
  @BeforeUpdate
  static async validateDouble(instance: Prediction) {
    if (instance.isDouble) {
      // Remove any existing double for this user in the same gameweek
      const fixture = await Fixture.findByPk(instance.fixtureId);
      if (fixture) {
        const gameweekFixtures = await Fixture.findAll({
          where: { gameweek: fixture.gameweek },
          attributes: ["id"],
        });

        const fixtureIds = gameweekFixtures.map((f) => f.id);

        await Prediction.update(
          { isDouble: false },
          {
            where: {
              userId: instance.userId,
              isDouble: true,
              fixtureId: {
                [Op.in]: fixtureIds,
              },
            },
          }
        );
      }
    }
  }

  // Calculate points based on prediction accuracy
  async calculatePoints(): Promise<number> {
    // Get fixture using the association
    const fixture = (await this.$get("fixture")) as Fixture;

    // Enhanced null/undefined checks for TypeScript strict mode
    if (
      !fixture ||
      fixture.homeScore === null ||
      fixture.homeScore === undefined ||
      fixture.awayScore === null ||
      fixture.awayScore === undefined
    ) {
      return 0;
    }

    let points = 0;
    const actualResult = this.getResult(fixture.homeScore, fixture.awayScore);
    const predictedResult = this.getResult(
      this.predictedHomeScore,
      this.predictedAwayScore
    );

    // Exact score: 6 points
    if (
      this.predictedHomeScore === fixture.homeScore &&
      this.predictedAwayScore === fixture.awayScore
    ) {
      points = 6;
    }
    // Correct result and goal difference: 4 points
    else if (
      predictedResult === actualResult &&
      this.predictedHomeScore - this.predictedAwayScore ===
        fixture.homeScore - fixture.awayScore
    ) {
      points = 4;
    }
    // Correct result only: 2 points
    else if (predictedResult === actualResult) {
      points = 2;
    }

    // Apply double multiplier
    if (this.isDouble) {
      points *= 2;
    }

    this.points = points;
    await this.save();
    return points;
  }

  // Updated getResult method with proper type handling
  private getResult(homeScore: number, awayScore: number): string {
    if (homeScore > awayScore) return "H";
    if (awayScore > homeScore) return "A";
    return "D";
  }

  // Static methods for leaderboard and statistics
  static async getLeaderboard() {
    const results = await this.findAll({
      attributes: [
        "userId",
        [fn("SUM", col("points")), "totalPoints"],
        [
          fn("COUNT", literal("CASE WHEN points > 0 THEN 1 END")),
          "correctPredictions",
        ],
        [fn("COUNT", col("Prediction.id")), "totalPredictions"], // Fix: Specify table alias
      ],
      include: [
        {
          model: User,
          attributes: ["username"],
          where: { isAdmin: false },
        },
        {
          model: Fixture,
          attributes: [],
          where: { status: "finished" },
        },
      ],
      group: ["userId", "user.id", "user.username"],
      order: [[fn("SUM", col("points")), "DESC"]],
      raw: false,
    });

    return results.map((result: any, index: number) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.user.username,
      totalPoints: parseInt(result.dataValues.totalPoints) || 0,
      correctPredictions: parseInt(result.dataValues.correctPredictions) || 0,
      totalPredictions: parseInt(result.dataValues.totalPredictions) || 0,
    }));
  }

  static async findByUserAndGameweek(userId: number, gameweek: number) {
    return this.findAll({
      where: { userId },
      include: [
        {
          model: Fixture,
          where: { gameweek },
          required: true,
        },
      ],
      order: [[{ model: Fixture, as: "fixture" }, "matchDate", "ASC"]],
    });
  }

  static async recalculateAllPoints() {
    const predictions = await this.findAll({
      include: [
        {
          model: Fixture,
          where: {
            status: "finished",
            homeScore: { [Op.not]: null },
            awayScore: { [Op.not]: null },
          },
        },
      ],
    });

    for (const prediction of predictions) {
      await prediction.calculatePoints();
    }

    return predictions.length;
  }
}
