# Deviations

Deviations is an interactive 3D digital art installation that reimagines Eero Saarinen's TWA Sunken Lounge and its Solari departure board. Its paired departures and arrivals boards cycle through satirical commitments in a suspended split-flap display.

The board is rendered in the browser with a panoramic glass curtain wall, vaulted shell, sunken red lounge, forward-stepping mechanical flaps, and an ambient mock-feed rotation.

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

- `src/App.tsx` owns the mock-feed state, ambient row scheduler, and **Refresh Feed** interaction.
- `src/data/mockFeed.ts` defines, formats, and rotates the commitment entries.
- `src/components/TWABoardHousing.tsx` builds the React Three Fiber scene: the suspended twin-sided board, panoramic windows, vaulted canopy, and sunken lounge.
- `src/components/BoardRow.tsx` lays out code, destination, gate, and severity-colored status flaps.
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
