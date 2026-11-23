# Deviations

Deviations is an interactive 3D digital art installation that reimagines Eero Saarinen's TWA Flight Center departure board. It tracks the promises the world keeps making against the realities that arrive instead: climate targets delayed, housing on hold, subsidies boarding on time.

The board is rendered in the browser as a sculptural split-flap display, with a warm architectural setting, mechanical flip animation, and a satirical mock feed.

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

- `src/App.tsx` owns the mock-feed state and the **Refresh Feed** interaction.
- `src/data/mockFeed.ts` defines and formats the 12 sample promises and realities.
- `src/components/TWABoardHousing.tsx` builds the React Three Fiber scene: the fiberglass housing, board face, lighting, and architectural backdrop.
- `src/components/BoardRow.tsx` lays out each category block, code, commitment, region, and status, with spacer flaps between fields.
- `src/components/SplitFlapChar.tsx` builds the shared glyph atlas and batches the flap and text geometry into instanced meshes. Its animation staggers the hinged panels across the board.
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
