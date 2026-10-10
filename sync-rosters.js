const { loadSeason, seasonNow } = require('./rosters');

async function main() {
  const years = Array.from({ length: seasonNow() - 2001 }, (_, index) => seasonNow() - index);
  let completed = 0;
  for (let i = 0; i < years.length; i += 4) {
    const batch = years.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map(loadSeason));
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') completed++;
      else console.warn(`${batch[j]}: ${result.reason.message}`);
    }
  }
  console.log(`Cached ${completed}/${years.length} nflverse roster seasons.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
