import { describe, expect, it } from 'vitest';
import {
  displayTeamName,
  normalizeTeamName,
} from '../../src/services/football/team-mapping.service';

describe('team name matching', () => {
  it('matches a club the provider abbreviates differently', () => {
    // Ours is NFO, football-data says NOT, so the name has to carry the match.
    expect(normalizeTeamName('Nottingham Forest FC')).toBe(
      normalizeTeamName('Nottingham Forest')
    );
  });

  it.each([
    ['Arsenal FC', 'Arsenal'],
    ['Sunderland AFC', 'Sunderland'],
    ['AFC Bournemouth', 'AFC Bournemouth'],
    ['Brighton & Hove Albion FC', 'Brighton & Hove Albion'],
    ['Manchester United FC', 'Manchester United'],
  ])('treats %s and %s as the same club', (providerName, ourName) => {
    expect(normalizeTeamName(providerName)).toBe(normalizeTeamName(ourName));
  });

  it('does not collapse two different clubs', () => {
    expect(normalizeTeamName('Manchester United FC')).not.toBe(
      normalizeTeamName('Manchester City FC')
    );
    expect(normalizeTeamName('Hull City AFC')).not.toBe(
      normalizeTeamName('Coventry City FC')
    );
  });

  it('ignores accents so spelling variants still match', () => {
    expect(normalizeTeamName('Atlético Madrid')).toBe(
      normalizeTeamName('Atletico Madrid')
    );
  });

  it.each([
    ['Coventry City FC', 'Coventry City'],
    ['Hull City AFC', 'Hull City'],
    ['Ipswich Town FC', 'Ipswich Town'],
    ['AFC Bournemouth', 'AFC Bournemouth'],
  ])('creates %s as %s', (providerName, expected) => {
    expect(displayTeamName(providerName)).toBe(expected);
  });
});
