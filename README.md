# Jersey Studio

A local chat interface and API for placing custom numbers on 32 jersey designs based on the supplied reference sheet. PNG exports are 1254 × 1254 with a transparent background.

## Run

```powershell
npm install
npm start
```

Open http://localhost:3000. Type a player name such as `Patrick Mahomes` to use their latest roster team and number. You can also choose any number with requests such as `Rams 10`, `Vikings number 28`, or `BUF #17`. If two players share a name, the chat asks you to choose one.

## Stats editor

Open `/stats.html` or use **Edit Stats** in the top bar. Upload an image or video, drag a box tightly around a percentage, multiplier, or count, and type the replacement value in the chat input. Repeat for other values, then export. Images download as PNG at the source dimensions. Videos record in real time as MP4 or WebM depending on browser support. The original media stays on the device; the browser processes the upload locally.

Only selected boxes are repainted. The editor samples the pixels beside each box to rebuild the background and uses a close sans-serif match for the replacement text. Exact typeface reconstruction from an arbitrary raster screenshot is not guaranteed. Video selections remain fixed throughout the clip, so moving overlays need another workflow. Browser support for canvas video recording and audio tracks varies.

Player lookup reads [nflverse roster CSV releases](https://github.com/nflverse/nflverse-data/releases/tag/rosters). The current season is refreshed every six hours when requested. A local CSV cache keeps lookup working if nflverse is temporarily unavailable; the chat labels cached results. Run `npm run sync:rosters` to cache seasons from 2002 onward for historical player searches.

## API

- `GET /api/teams` lists all supported teams.
- `POST /api/generate` accepts JSON such as `{ "message": "Patrick Mahomes" }`, `{ "message": "Chiefs 87" }`, or `{ "team": "Chiefs", "number": "87" }` and returns a PNG URL.
- `GET /api/jersey/:code/:number.png` returns the transparent PNG.
- `GET /api/download/:code/:number.png` downloads it as a PNG attachment with a `.png` filename.
- The chat's Download PNG link uses the browser's native download flow on desktop and mobile. `POST /api/save/:code/:number.png` remains available for local use only; a hosted server cannot write to a visitor's Downloads folder.

## Jersey catalog

The app ships with 32 separately generated, blank, high-resolution jersey PNGs in `assets/teams-generated`. The cleaned 1254 × 1254 transparent versions used by the renderer are in `assets/teams-ready`; [catalog-preview.png](assets/catalog-preview.png) shows all 32. Each was generated to match its reference-sheet color, collar, and sleeve stripes. These are newly generated images, so fine cloth details can differ from the small original reference.

`npm run clean:catalog` rebuilds the transparent runtime assets from the generated originals. The cleaning step removes background fringe and preserves the garment size. `npm run preview:catalog` rebuilds the overview. At runtime, [Sharp](https://sharp.pixelplumbing.com/) composites numbers using the jersey's own fabric shading and team-colored outlines. Generation requests need no GPU.

If a generated base is missing, the renderer falls back to `assets/teams-hq`, then to the original crop. To regenerate original crops from `assets/jersey-sheet.png`, run `npm run import:sheet`. `npm run prepare:gpu` and `npm run enhance:jerseys` remain optional ways to remake the fallback bases.
