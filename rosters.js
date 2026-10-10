const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { teams, findTeam } = require('./teams');

const DATA_DIR = path.join(__dirname, 'data');
const FRESH_MS = 6 * 60 * 60 * 1000;
const MIN_SEASON = 2002;
const memory = new Map();
const inFlight = new Map();
const teamCodes = new Map(teams.map(team => [team.code, team]));
const legacyCodes = { LA: 'LAR', STL: 'LAR', SD: 'LAC', OAK: 'LV', WSH: 'WAS', WFT: 'WAS', JAC: 'JAX' };
const activeStatuses = new Set(['ACT', 'INA', 'RES', 'DEV']);

function seasonNow() {
  const today = new Date();
  return today.getUTCFullYear() - (today.getUTCMonth() < 2 ? 1 : 0);
}

function normalized(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function reducedQuery(message) {
  return normalized(message).replace(/\b(make|create|give|show|get|me|my|a|an|the|i|want|would|like|please|jersey|shirt|player|for|of|with|latest|current|nfl|football|number|no)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function containsWords(haystack, needle) {
  return !!needle && (` ${haystack} `).includes(` ${needle} `);
}

function parseCsv(csv, season, fetchedAt) {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true });
  if (!rows.length || !('full_name' in rows[0]) || !('jersey_number' in rows[0]) || !('team' in rows[0])) throw new Error('Unexpected nflverse roster format');
  return { season, fetchedAt, rows: rows.filter(row => row.full_name && row.team && /^\d{1,4}$/.test(row.jersey_number || '')) };
}

async function loadSeason(season) {
  if (inFlight.has(season)) return inFlight.get(season);
  const task = (async () => {
    const file = path.join(DATA_DIR, `roster_${season}.csv`);
    const previous = memory.get(season);
    if (previous && (season !== seasonNow() || Date.now() - previous.fetchedAt < FRESH_MS)) return previous;
    let stat;
    try { stat = fs.statSync(file); } catch { /* no cache yet */ }
    if (stat && (season !== seasonNow() || Date.now() - stat.mtimeMs < FRESH_MS)) {
      const cached = parseCsv(fs.readFileSync(file, 'utf8'), season, stat.mtimeMs);
      memory.set(season, cached);
      return cached;
    }
    const url = `https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_${season}.csv`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'JerseyStudio/1.0' } });
      if (!response.ok) throw new Error(`nflverse HTTP ${response.status}`);
      const csv = await response.text();
      const loaded = parseCsv(csv, season, Date.now());
      if (!process.env.VERCEL) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(file, csv);
      }
      memory.set(season, loaded);
      return loaded;
    } catch (error) {
      if (stat) {
        const cached = parseCsv(fs.readFileSync(file, 'utf8'), season, stat.mtimeMs);
        cached.stale = true;
        memory.set(season, cached);
        return cached;
      }
      if (previous) { previous.stale = true; return previous; }
      throw error;
    }
  })();
  inFlight.set(season, task);
  try { return await task; } finally { inFlight.delete(season); }
}

function score(row, query, message) {
  const name = normalized(row.full_name);
  const first = normalized(row.first_name);
  const last = normalized(row.last_name);
  if (query === name) return 100;
  if (containsWords(query, name)) return 95;
  if (containsWords(message, name)) return 90;
  if (query === last && last.length >= 4) return 70;
  if (query === `${first[0]} ${last}` && last.length >= 4) return 75;
  return 0;
}

function candidatesFrom(data, input, teamHint) {
  const message = normalized(input);
  const query = reducedQuery(input);
  if (!query) return [];
  const matches = [];
  for (const row of data.rows) {
    const code = legacyCodes[row.team] || row.team;
    const team = teamCodes.get(code);
    if (!team || (teamHint && team.code !== teamHint.code)) continue;
    const value = score(row, query, message);
    if (value) matches.push({ name: row.full_name, number: row.jersey_number, team, season: data.season, status: row.status, id: row.gsis_id || `${row.full_name}:${row.team}`, score: value, fetchedAt: data.fetchedAt, stale: !!data.stale });
  }
  const best = Math.max(0, ...matches.map(x => x.score));
  return matches.filter(x => x.score === best).sort((a, b) => Number(activeStatuses.has(b.status)) - Number(activeStatuses.has(a.status)) || a.name.localeCompare(b.name));
}

async function findPlayer(input, teamHint = null) {
  const current = seasonNow();
  let networkFailed = false;
  for (let season = current; season >= MIN_SEASON; season--) {
    let data;
    try { data = await loadSeason(season); } catch { networkFailed = true; continue; }
    const matches = candidatesFrom(data, input, teamHint);
    if (matches.length) return { matches, season, fetchedAt: data.fetchedAt, stale: data.stale || networkFailed };
  }
  return { matches: [], networkFailed };
}

module.exports = { findPlayer, loadSeason, seasonNow };
