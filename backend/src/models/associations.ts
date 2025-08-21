/* filepath: backend/src/models/associations.ts */
import { User } from './User';
import { Fixture } from './Fixture';
import { Prediction } from './Prediction';

export function setupAssociations() {
  // User associations
  User.hasMany(Prediction, { 
    foreignKey: 'userId',
    as: 'predictions'
  });
  
  // Fixture associations
  Fixture.hasMany(Prediction, { 
    foreignKey: 'fixtureId',
    as: 'predictions'
  });
  
  // Prediction associations
  Prediction.belongsTo(User, { 
    foreignKey: 'userId',
    as: 'user'
  });
  
  Prediction.belongsTo(Fixture, { 
    foreignKey: 'fixtureId',
    as: 'fixture'
  });

  console.log('✅ Database associations set up successfully');
}