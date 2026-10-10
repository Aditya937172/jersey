const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { teams, findTeam } = require('./teams');
const { render } = require('./renderer');
const { findPlayer } = require('./rosters');

const app = express();
const port = Number(process.env.PORT) || 3000;
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function parseRequest(body) {
  const message = String(body.message || '').slice(0, 300);
  const directNumber = body.number === undefined ? '' : String(body.number).trim();
  const number = directNumber || (message.match(/(?:#|number\s*|no\.?\s*)(\d{1,4})\b/i) || message.match(/\b(\d{1,4})\b/))?.[1];
  const team = findTeam(body.team || message);
  if (number && team && /^\d{1,4}$/.test(number)) return { team, number };
  if (number && !/^\d{1,4}$/.test(number)) return { error: 'Add a number from 0 to 9999.' };
  if (number && !team) return { error: 'Add a team name with that number, like “Chiefs 87”.' };
  const lookup = await findPlayer(body.player || message, team);
  if (lookup.matches.length === 1) {
    const player = lookup.matches[0];
    return { team: player.team, number: player.number, player: player.name, season: player.season, rosterAsOf: new Date(player.fetchedAt).toISOString(), rosterStale: player.stale };
  }
  if (lookup.matches.length > 1) return { error: 'I found more than one player with that name. Choose the one you mean:', choices: lookup.matches.slice(0, 8).map(player => ({ label: `${player.name} · ${player.team.name} #${player.number}`, prompt: `${player.name} ${player.team.name}` })) };
  if (lookup.networkFailed) return { error: 'I could not reach the nflverse roster data. Try again shortly, or type a team and number.' };
  if (team) return { error: `I could not find that player on the ${team.name} roster. You can still type “${team.name} 10” with any number.` };
  return { error: 'I could not find that player in nflverse rosters. Try a full player name, or type a team and number.' };
}

app.get('/api/teams', (_req, res) => res.json(teams.map(({ name, code, body, accent }) => ({ name, code, body, accent }))));

app.post('/api/generate', async (req, res, next) => {
  try {
    const result = await parseRequest(req.body || {});
    if (result.choices) return res.json(result);
    if (result.error) return res.status(400).json(result);
    const { team, number, player, season, rosterAsOf, rosterStale } = result;
    res.json({ team: team.name, code: team.code, number, player, season, rosterAsOf, rosterStale, imageUrl: `/api/jersey/${team.code}/${number}.png?v=catalog-4`, downloadUrl: `/api/download/${team.code}/${number}.png`, downloadName: `${team.code.toLowerCase()}-${number}-jersey.png` });
  } catch (error) { next(error); }
});

async function sendJersey(req, res, next, download = false) {
  const team = teams.find(t => t.code.toLowerCase() === req.params.code.toLowerCase());
  const number = req.params.number;
  if (!team || !/^\d{1,4}$/.test(number)) return res.status(404).json({ error: 'Jersey not found.' });
  try {
    const png = await render(team, number);
    res.type('png');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    if (download) res.attachment(`${team.code.toLowerCase()}-${number}-jersey.png`);
    res.send(png);
  } catch (error) { next(error); }
}

app.get('/api/jersey/:code/:number.png', (req, res, next) => sendJersey(req, res, next));
app.get('/api/download/:code/:number.png', (req, res, next) => sendJersey(req, res, next, true));

app.post('/api/save/:code/:number.png', async (req, res, next) => {
  if (process.env.VERCEL) return res.status(501).json({ error: 'Use the Download PNG link to save the image on this device.' });
  if (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin') return res.status(403).json({ error: 'Open the jersey app to save a file.' });
  const team = teams.find(t => t.code.toLowerCase() === req.params.code.toLowerCase());
  const number = req.params.number;
  if (!team || !/^\d{1,4}$/.test(number)) return res.status(404).json({ error: 'Jersey not found.' });
  try {
    const png = await render(team, number);
    const downloads = path.join(os.homedir(), 'Downloads');
    await fs.promises.mkdir(downloads, { recursive: true });
    const stem = `${team.code.toLowerCase()}-${number}-jersey`;
    for (let copy = 1; copy <= 999; copy++) {
      const name = `${stem}${copy === 1 ? '' : `-${copy}`}.png`;
      const savedTo = path.join(downloads, name);
      try {
        const file = await fs.promises.open(savedTo, 'wx');
        try { await file.writeFile(png); } finally { await file.close(); }
        return res.json({ name, savedTo, bytes: png.length });
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    throw new Error('Too many saved copies of this jersey.');
  } catch (error) { next(error); }
});

app.use((req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'The jersey could not be rendered. Please try again.' });
});

module.exports = app;
if (!process.env.VERCEL) app.listen(port, () => console.log(`Jersey Studio running at http://localhost:${port}`));
