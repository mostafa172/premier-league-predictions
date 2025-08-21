import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { Prediction } from './Prediction';

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['username']
    },
    {
      fields: ['email']
    }
  ]
})
export class User extends Model<User> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true
  })
  id!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  username!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    unique: true
  })
  email!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false
  })
  password!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_admin'
  })
  isAdmin!: boolean;

  @HasMany(() => Prediction)
  predictions!: Prediction[];

  // Instance methods
  toJSON() {
    const values = Object.assign({}, this.get());
    const { password, ...userWithoutPassword } = values;
    return userWithoutPassword;
  }
}