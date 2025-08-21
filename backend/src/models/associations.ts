/* filepath: backend/src/models/associations.ts */
import { User } from './User';
import { Team } from './Team';
import { Fixture } from './Fixture';
import { Prediction } from './Prediction';

export function setupAssociations() {
  console.log('🔗 Setting up database associations...');

  // Clear any existing associations first
  Object.keys(Team.associations || {}).forEach(key => {
    delete Team.associations[key];
  });
  Object.keys(Fixture.associations || {}).forEach(key => {
    delete Fixture.associations[key];
  });
  Object.keys(User.associations || {}).forEach(key => {
    delete User.associations[key];
  });
  Object.keys(Prediction.associations || {}).forEach(key => {
    delete Prediction.associations[key];
  });

  // Team associations - each team can have many fixtures as home or away
  Team.hasMany(Fixture, { 
    foreignKey: 'homeTeamId', 
    as: 'homeFixtures' 
  });
  
  Team.hasMany(Fixture, { 
    foreignKey: 'awayTeamId', 
    as: 'awayFixtures' 
  });

  // Fixture associations - each fixture belongs to two teams
  Fixture.belongsTo(Team, { 
    foreignKey: 'homeTeamId', 
    as: 'homeTeam' 
  });
  
  Fixture.belongsTo(Team, { 
    foreignKey: 'awayTeamId', 
    as: 'awayTeam' 
  });

  // Fixture can have many predictions
  Fixture.hasMany(Prediction, { 
    foreignKey: 'fixtureId', 
    as: 'predictions' 
  });

  // User associations - each user can have many predictions
  User.hasMany(Prediction, { 
    foreignKey: 'userId', 
    as: 'predictions' 
  });

  // Prediction associations - each prediction belongs to one user and one fixture
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