# Deviations

Deviations is an interactive 3D digital art installation inspired by Eero Saarinen's TWA Flight Center and its Solari split-flap board. Its two boards track the world's governance commitments as if they were flights:

- **DEPARTURES**: newly agreed global commitments, with ambitious horizons and no immediate enforcement.
- **ARRIVALS**: older commitments whose target dates have slipped, been re-baselined or entered review.

Every entry is satire. Each one parodies a real initiative of the UN, COP, the plastics INC, the Basel Committee, the OECD, the WTO and others. Clicking a row opens its dossier, which links to the **official source** for the real initiative behind it.

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

The static site is written to `dist/`. Run `npm run check-links` to verify that every official source link still resolves.

`.github/workflows/daily-board-check.yml` replaces the old daily RSS sync. It runs every day at 05:17 UTC, on demand, and on every change to the content. It builds the site and checks the source links, failing if any link is broken. It never commits to the repository: the 24-hour rotation happens in the browser.

## Architecture

### Content

- `src/data/governancePool.ts` holds the satirical database: 26 departures and 26 arrivals. Each entry has its board code, initiative, target year, status cycle, dossier, schedule history and official source.
- `src/data/governanceService.ts` holds the 24-hour rotation (`ROTATION_PERIOD = 86_400_000`). A seed derived from the UTC day shuffles each board's queue and picks the 7 featured rows. Each entry's status advances one step per day through its cycle, for example `PLEDGED → DRAFTING → SIGNED`. Ambient flips walk the rest of the queue, so nothing repeats until the pool runs out. There is no server or scheduled job; every visitor sees the same rotation on the same day.
- `src/App.tsx` re-syncs at each rotation boundary and whenever the tab regains focus. It also schedules ambient row flips and renders the dossier panel.

### Split-flap engine (`src/components/SplitFlapChar.tsx`)

- Every cell has four single-sided leaves: a fixed top, a fixed bottom, and the hinged flap's front and back. All are batched into instanced meshes.
- Each leaf composites its background colour and its glyph in one shader (`mix(background, ink, atlas)`). There are no transparent glyph layers to sort or z-fight, and coplanar surfaces are at least 1.2 mm apart.
- The fixed top shows the incoming character as soon as the flap is released. The fixed bottom keeps the outgoing character until the flap lands, so colour changes happen behind the falling leaf and never bleed through.
- The flap swings 180° about the crease hinge, accelerating like a body under gravity (`θ = π·s²`), then settles with a two-bounce damped rebound.
- Steps run on wall-clock time, so the cascade stays correct at low frame rates and after a hidden tab returns.
- The drum only turns forward through the spool. Cells cascade row by row and left to right, and each drum motor runs at its own slightly different speed.

### Scene (`src/components/TWABoardHousing.tsx`, `src/components/scene/`)

- `layout.ts` defines one shared layout: floor plane, window-wall plan line, rake, and the shell surface function. Every element is placed against it, and a dev-time check rejects overlapping lounges or furniture that crosses the glass.
- `Shell.tsx` builds the double-curved, winged vault as a parametric surface, with baked ambient occlusion, rounded concrete rims, a skylight seam and flared piers.
- `GlassWall.tsx` builds the raked, faceted green-tinted curtain wall, whose top edge follows the shell, plus instanced mullions and transoms.
- `Lounge.tsx` builds three sculpted lounge islands: an undercut white rim, a carpeted well, a continuous upholstered bench with sheen, a pedestal table and steps. It also lays the crimson carpet floor.
- `Exterior.tsx` builds the gradient sky with sun glow, the apron with taxi markings, parked and taxiing jets, and a distant tower and hangars.
- `textures.ts` generates tileable procedural PBR maps (colour, normal, roughness) for concrete, carpet, upholstery and tarmac. There are no binary assets, and nothing is downloaded at runtime.
- Rendering uses soft shadow maps and contact shadows, image-based lighting from code-generated light cards (no HDRI download), N8AO ambient occlusion, bloom, ACES Filmic tone mapping, SMAA and a vignette. `PerformanceMonitor` drops AO and resolution on slower GPUs.
- `CameraControls` provides damped orbit and zoom within limits that keep the view inside the hall, and glides to a row when it's selected. Portrait screens get a wider lens.

### Sound (`src/utils/soundEngine.ts`)

Procedural clatter: a filtered noise tick plus a low housing knock, panned toward the board that's flipping. Voices are pooled so a full cascade doesn't clip. Sound starts muted, and the header toggle turns it on and off.

## Static deployment

All three platforms use the same static build:

| Platform | Build command | Output directory | Base path |
| --- | --- | --- | --- |
| Vercel | `npm run build` | `dist` | `/` by default |
| Netlify | `npm run build` | `dist` | `/` by default |
| GitHub Pages | `npm run build` | `dist` | Set `VITE_BASE_PATH` for a project site |

For GitHub Pages hosted at `https://<user>.github.io/<repository>/`, build with the repository path as `VITE_BASE_PATH`:

```sh
VITE_BASE_PATH=/Deviations/ npm run build
```
