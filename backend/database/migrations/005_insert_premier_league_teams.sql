/* filepath: backend/database/migrations/005_insert_premier_league_teams.sql */
-- Insert all 2025/26 Premier League teams
INSERT INTO teams (name, abbreviation, logo_url, color_primary, color_secondary, founded_year, stadium) VALUES
('Arsenal', 'ARS', '/assets/logos/arsenal.png', '#EF0107', '#063672', 1886, 'Emirates Stadium'),
('Aston Villa', 'AVL', '/assets/logos/aston-villa.png', '#95BFE5', '#670E36', 1874, 'Villa Park'),
('AFC Bournemouth', 'BOU', '/assets/logos/bournemouth.png', '#DA020E', '#000000', 1899, 'Vitality Stadium'),
('Brentford', 'BRE', '/assets/logos/brentford.png', '#E30613', '#FFD100', 1889, 'Brentford Community Stadium'),
('Brighton & Hove Albion', 'BHA', '/assets/logos/brighton.png', '#0057B8', '#FFCD00', 1901, 'Amex Stadium'),
('Burnley', 'BUR', '/assets/logos/burnley.png', '#6C1D45', '#99D6EA', 1882, 'Turf Moor'),
('Chelsea', 'CHE', '/assets/logos/chelsea.png', '#034694', '#034694', 1905, 'Stamford Bridge'),
('Crystal Palace', 'CRY', '/assets/logos/crystal-palace.png', '#1B458F', '#A7A5A6', 1905, 'Selhurst Park'),
('Everton', 'EVE', '/assets/logos/everton.png', '#003399', '#003399', 1878, 'Goodison Park'),
('Fulham', 'FUL', '/assets/logos/fulham.png', '#000000', '#FFFFFF', 1879, 'Craven Cottage'),
('Leeds United', 'LEE', '/assets/logos/leeds.png', '#FFCD00', '#1D428A', 1919, 'Elland Road'),
('Liverpool', 'LIV', '/assets/logos/liverpool.png', '#C8102E', '#00B2A9', 1892, 'Anfield'),
('Manchester City', 'MCI', '/assets/logos/man-city.png', '#6CABDD', '#1C2C5B', 1880, 'Etihad Stadium'),
('Manchester United', 'MUN', '/assets/logos/man-united.png', '#DA020E', '#FBE122', 1878, 'Old Trafford'),
('Newcastle United', 'NEW', '/assets/logos/newcastle.png', '#241F20', '#FFFFFF', 1892, 'St. James Park'),
('Nottingham Forest', 'NFO', '/assets/logos/nottingham-forest.png', '#DD0000', '#FFFFFF', 1865, 'City Ground'),
('Sunderland', 'SUN', '/assets/logos/sunderland.png', '#E2231A', '#000000', 1879, 'Stadium of Light'),
('Tottenham Hotspur', 'TOT', '/assets/logos/tottenham.png', '#132257', '#FFFFFF', 1882, 'Tottenham Hotspur Stadium'),
('West Ham United', 'WHU', '/assets/logos/west-ham.png', '#7A263A', '#1BB1E7', 1895, 'London Stadium'),
('Wolverhampton Wanderers', 'WOL', '/assets/logos/wolves.png', '#FDB462', '#231F20', 1877, 'Molineux Stadium');

-- Verify teams were inserted
SELECT COUNT(*) as team_count FROM teams;

-- Display all teams
SELECT id, name, abbreviation, stadium FROM teams ORDER BY name;