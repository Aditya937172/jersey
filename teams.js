const teams = [
  ['Arizona Cardinals', 'ARI', '#c8102e', '#ffffff', '#ffffff', ['arizona', 'cardinals']],
  ['Atlanta Falcons', 'ATL', '#1b1b1b', '#a71930', '#ffffff', ['atlanta', 'falcons']],
  ['Baltimore Ravens', 'BAL', '#4b2e83', '#d4aa42', '#ffffff', ['baltimore', 'ravens']],
  ['Buffalo Bills', 'BUF', '#005bbb', '#c60c30', '#ffffff', ['buffalo', 'bills']],
  ['Carolina Panthers', 'CAR', '#202124', '#0085ca', '#ffffff', ['carolina', 'panthers']],
  ['Chicago Bears', 'CHI', '#0b2545', '#e65c17', '#ffffff', ['chicago', 'bears']],
  ['Cincinnati Bengals', 'CIN', '#ef6100', '#171717', '#ffffff', ['cincinnati', 'bengals']],
  ['Cleveland Browns', 'CLE', '#3d2419', '#e65e1b', '#ffffff', ['cleveland', 'browns']],
  ['Dallas Cowboys', 'DAL', '#b5b9c3', '#092954', '#ffffff', ['dallas', 'cowboys']],
  ['Denver Broncos', 'DEN', '#ed5a16', '#0b2647', '#ffffff', ['denver', 'broncos']],
  ['Detroit Lions', 'DET', '#0076b6', '#ffffff', '#ffffff', ['detroit', 'lions']],
  ['Green Bay Packers', 'GB', '#0d5a35', '#ffb81c', '#ffffff', ['green bay', 'packers', 'greenbay']],
  ['Houston Texans', 'HOU', '#0b2345', '#c8102e', '#ffffff', ['houston', 'texans']],
  ['Indianapolis Colts', 'IND', '#1452a4', '#ffffff', '#ffffff', ['indianapolis', 'colts', 'indy']],
  ['Jacksonville Jaguars', 'JAX', '#087f8f', '#d4a957', '#ffffff', ['jacksonville', 'jaguars', 'jags']],
  ['Kansas City Chiefs', 'KC', '#c8102e', '#ffb81c', '#ffffff', ['kansas city', 'chiefs', 'kansascity']],
  ['Las Vegas Raiders', 'LV', '#252525', '#f4f4f4', '#ffffff', ['las vegas', 'raiders', 'vegas']],
  ['Los Angeles Chargers', 'LAC', '#1689e2', '#ffb81c', '#ffffff', ['chargers', 'la chargers', 'los angeles chargers']],
  ['Los Angeles Rams', 'LAR', '#0055d8', '#ffb81c', '#ffffff', ['rams', 'la rams', 'los angeles rams']],
  ['Miami Dolphins', 'MIA', '#00a6aa', '#fc4c02', '#ffffff', ['miami', 'dolphins']],
  ['Minnesota Vikings', 'MIN', '#56339b', '#ffc62f', '#ffffff', ['minnesota', 'vikings']],
  ['New England Patriots', 'NE', '#10284c', '#c8102e', '#ffffff', ['new england', 'patriots', 'pats']],
  ['New Orleans Saints', 'NO', '#242424', '#d3aa5b', '#ffffff', ['new orleans', 'saints']],
  ['New York Giants', 'NYG', '#f6f6f6', '#1752a5', '#1752a5', ['giants', 'ny giants', 'new york giants']],
  ['New York Jets', 'NYJ', '#11613a', '#ffffff', '#ffffff', ['jets', 'ny jets', 'new york jets']],
  ['Philadelphia Eagles', 'PHI', '#075057', '#1e1e1e', '#ffffff', ['philadelphia', 'eagles', 'philly']],
  ['Pittsburgh Steelers', 'PIT', '#242424', '#ffb81c', '#ffffff', ['pittsburgh', 'steelers']],
  ['San Francisco 49ers', 'SF', '#aa001d', '#d8ad59', '#ffffff', ['san francisco', '49ers', 'niners', 'sf']],
  ['Seattle Seahawks', 'SEA', '#0b3156', '#69be28', '#ffffff', ['seattle', 'seahawks']],
  ['Tampa Bay Buccaneers', 'TB', '#c8102e', '#8a8a8a', '#ffffff', ['tampa bay', 'buccaneers', 'bucs']],
  ['Tennessee Titans', 'TEN', '#147bd1', '#0b2545', '#ffffff', ['tennessee', 'titans']],
  ['Washington Commanders', 'WAS', '#5a1f2b', '#ffb81c', '#ffffff', ['washington', 'commanders']]
].map(([name, code, body, accent, stripe, aliases]) => ({ name, code, body, accent, stripe, aliases }));

function findTeam(input) {
  const value = String(input || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return null;
  return teams.find(t => value === t.name.toLowerCase() || value === t.code.toLowerCase() || t.aliases.some(a => value === a))
    || teams.find(t => t.aliases.some(a => value.includes(a) && a.length > 2))
    || null;
}

module.exports = { teams, findTeam };
