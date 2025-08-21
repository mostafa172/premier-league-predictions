/* filepath: backend/src/models/associations.ts */
import { User } from './User';
import { Fixture } from './Fixture';
import { Prediction } from './Prediction';
import { Team } from './Team';

export function setupAssociations() {
  // Team associations
  Team.hasMany(Fixture, { 
    foreignKey: 'homeTeamId',
    as: 'homeFixtures'
  });
  
  Team.hasMany(Fixture, { 
    foreignKey: 'awayTeamId',
    as: 'awayFixtures'
  });

  // Fixture associations
  Fixture.belongsTo(Team, { 
    foreignKey: 'homeTeamId',
    as: 'homeTeam'
  });
  
  Fixture.belongsTo(Team, { 
    foreignKey: 'awayTeamId',
    as: 'awayTeam'
  });

  // Existing associations...
  User.hasMany(Prediction, { 
    foreignKey: 'userId',
    as: 'predictions'
  });
  
  Fixture.hasMany(Prediction, { 
    foreignKey: 'fixtureId',
    as: 'predictions'
  });
  
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