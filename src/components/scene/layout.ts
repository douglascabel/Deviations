/*
 * Shared spatial layout for the terminal. Every element that touches the floor, the window wall or
 * the shell derives its position from these functions, so nothing floats, clips or drifts out of
 * register when a dimension changes.
 */

export const FLOOR_Y = -5.68;

/** Board housing centre. */
export const BOARD_Y = 2.12;
export const BOARD_Z = 0.3;
export const BOARD_SIDE_OFFSET = 4.2;
export const BOARD_TITLE_Y = 1.96;
export const BOARD_HEADINGS_Y = 1.42;
export const FIRST_ROW_Y = 0.98;
export const ROW_PITCH = 0.4;

/** Half-width of the shell and the window wall. */
export const SHELL_HALF_WIDTH = 17.5;
/** Half-width of the skylight seam where the two wings of the shell meet. */
export const SEAM_HALF_WIDTH = 0.34;
export const SHELL_FRONT_Z = 70;

/** Plan line of the base of the glass wall: a shallow concave sweep toward the hall. */
export function wallZ(x: number): number {
  return -9.4 + (x / 14) ** 2 * 2.3;
}

/** The window wall rakes outward as it rises, as at the TWA Flight Center. */
export const WALL_RAKE = 0.13;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Underside height of the shell at (x, z). Two wing lobes rise from the edge piers, dip toward the
 * central skylight seam, and lift steeply toward the window wall like the leading edge of a wing.
 */
export function shellY(x: number, z: number): number {
  const s = Math.min(1, Math.abs(x) / SHELL_HALF_WIDTH);
  const lobe = 0.36 + 0.64 * Math.sin(Math.PI * Math.min(1, s * 1.04)) ** 0.82;
  const edgeFall = 1 - smoothstep(0.82, 1, s) * 0.55;
  const lift = smoothstep(16, -9.5, z);
  // A gentle saddle along z gives the vault its double curvature.
  const saddle = 1 + 0.06 * Math.sin((z + 9.5) * 0.16);
  return 6.1 + (6.2 + 4.2 * lift) * lobe * edgeFall * saddle;
}

/** Top of the raked window wall at x: where the glass meets the underside of the shell. */
export function glassTop(x: number): { y: number; z: number } {
  const baseZ = wallZ(x);
  const roughHeight = shellY(x, baseZ) - FLOOR_Y;
  const z = baseZ - WALL_RAKE * roughHeight;
  return { y: shellY(x, z) - 0.04, z };
}

/** Back edge of the shell: it overhangs the top of the glass like a wing's leading edge. */
export function shellBackZ(x: number): number {
  return glassTop(x).z - 0.9;
}

export interface LoungePlacement {
  x: number;
  z: number;
  rotation: number;
  radius: number;
}

/** Three sunken conversation lounges, in front of the board and clear of the window wall. */
export const LOUNGES: LoungePlacement[] = [
  { x: 0, z: 5.6, rotation: 0.1, radius: 2.65 },
  { x: -7.2, z: 0.4, rotation: -0.5, radius: 2.65 },
  { x: 7.2, z: -1.6, rotation: 0.6, radius: 2.65 },
];

/** Dev-time guard: lounges must not overlap each other or the glass, and must sit on the floor. */
export function validateLayout(): string[] {
  const problems: string[] = [];
  const clearance = 0.6;
  LOUNGES.forEach((a, i) => {
    LOUNGES.slice(i + 1).forEach((b, j) => {
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (distance < a.radius + b.radius + clearance) {
        problems.push(`Lounges ${i} and ${i + j + 1} overlap (${distance.toFixed(2)} apart).`);
      }
    });
    if (a.z - a.radius < wallZ(a.x) + 1) problems.push(`Lounge ${i} intersects the window wall.`);
    if (Math.abs(a.x) + a.radius > SHELL_HALF_WIDTH - 1) problems.push(`Lounge ${i} is outside the hall.`);
  });
  return problems;
}
