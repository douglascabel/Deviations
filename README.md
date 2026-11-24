# Deviations

Deviations is an interactive 3D digital art installation inspired by Eero Saarinen's TWA Flight Center and its Solari departure board. Its paired boards cycle through current headlines from major international publishers in a suspended split-flap display.

The board is rendered in the browser with a panoramic glass curtain wall, vaulted shell, red-carpet lounge islands, forward-stepping mechanical flaps, and an automatically refreshed news feed.

## Getting started

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Create and preview a production build:

```sh
npm run build
npm run preview
```

The static site is written to `dist/`.

## Architecture

- `src/App.tsx` owns the cached news-feed state, ambient row scheduler, and **Refresh Feed** interaction.
- `src/data/feedService.ts` formats publisher headlines for the flap grid and refreshes the browser's local feed cache every 24 hours.
- `public/feed.json` is the static article store. `.github/workflows/sync-news-feed.yml` runs daily and updates it from publisher RSS feeds; `workflow_dispatch` can trigger a manual sync.
- `scripts/sync-feed.mjs` fetches The New York Times, The Atlantic, The Washington Post, Reuters, AP News, The Guardian, NPR, and BBC News feeds, retaining each unavailable publisher's recent articles when its RSS endpoint is temporarily unavailable.
- `src/components/TWABoardHousing.tsx` builds the React Three Fiber scene: the suspended oval board, panoramic windows, vaulted canopy, carpet, and three lounge islands.
- `src/components/BoardRow.tsx` lays out flight, origination, time, and dynamic status flaps.
- `src/components/SplitFlapChar.tsx` builds the shared Aptos-style glyph atlas and batches flap and text geometry into instanced meshes. Its animation steps forward through the spool and staggers hinged panels across the board.
- `src/index.css` and `tailwind.config.js` provide the page styling.

The app uses React and TypeScript, Vite, Tailwind CSS, Three.js, `@react-three/fiber`, and `@react-three/drei`.

## Static deployment

All three platforms use the same static build:

| Platform | Build command | Output directory | Base path |
| --- | --- | --- | --- |
| Vercel | `npm run build` | `dist` | `/` by default |
| Netlify | `npm run build` | `dist` | `/` by default |
| GitHub Pages | `npm run build` | `dist` | Set `VITE_BASE_PATH` for a project site |

For Vercel or Netlify, use the Vite preset or set the build command and output directory above. For GitHub Pages hosted at `https://<user>.github.io/<repository>/`, build with the repository path as `VITE_BASE_PATH`:

```sh
VITE_BASE_PATH=/Deviations/ npm run build
```

Replace `Deviations` with the repository name. The path is normalized to start and end with `/`; omit the variable for a root-domain deployment.
