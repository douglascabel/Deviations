import * as THREE from 'three';
import {
  BALCONY,
  FLOOR_Y,
  SEAM_HALF_WIDTH,
  SHELL_FRONT_Z,
  SHELL_HALF_WIDTH,
  glassTop,
  shellBackZ,
  shellY,
  wallZ,
} from './layout';

/*
 * Invisible, low-resolution collision surfaces for the camera. CameraControls casts rays from its
 * target to the corners of the camera's near plane and pulls the camera in front of the first hit,
 * so the view can never pass through the vault, the walls, the glass, the balconies or the floor
 * (which would clip geometry and make surfaces look transparent). The meshes are never added to the
 * scene: their geometry is authored in world space and their world matrix stays identity.
 */

const MARGIN = 0.6;
const EYE_HEIGHT = 1.4;
const colliderMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

function grid(
  columns: number,
  rows: number,
  point: (u: number, v: number) => [number, number, number],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= columns; i += 1) positions.push(...point(i / columns, j / rows));
  }
  const row = columns + 1;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      const a = j * row + i;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function makeCameraColliders(): THREE.Mesh[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Underside of the vault (both wings, bridging the seam), lowered by a margin.
  geometries.push(
    grid(32, 24, (u, v) => {
      const x = -SHELL_HALF_WIDTH + 2 * SHELL_HALF_WIDTH * u;
      const z0 = shellBackZ(Math.max(Math.abs(x), SEAM_HALF_WIDTH));
      const z = z0 + (SHELL_FRONT_Z - z0) * v;
      return [x, shellY(Math.max(Math.abs(x), SEAM_HALF_WIDTH), z) - MARGIN, z];
    }),
  );

  // Floor at eye height, so the camera never dips into the lounges or the carpet.
  geometries.push(
    grid(1, 1, (u, v) => [
      -SHELL_HALF_WIDTH + 2 * SHELL_HALF_WIDTH * u,
      FLOOR_Y + EYE_HEIGHT,
      -12 + (SHELL_FRONT_Z + 12) * v,
    ]),
  );

  // Side walls, inset by the balcony depth so the camera also stays clear of the balconies.
  for (const side of [-1, 1]) {
    geometries.push(
      grid(1, 1, (u, v) => [
        side * (SHELL_HALF_WIDTH - BALCONY.depth - MARGIN),
        FLOOR_Y + (20 * v),
        -12 + (SHELL_FRONT_Z + 12) * u,
      ]),
    );
  }

  // The raked glass wall, pulled into the hall by a margin.
  geometries.push(
    grid(24, 1, (u, v) => {
      const x = -SHELL_HALF_WIDTH + 2 * SHELL_HALF_WIDTH * u;
      const top = glassTop(x);
      return v === 0 ? [x, FLOOR_Y, wallZ(x) + MARGIN] : [x, top.y, top.z + MARGIN];
    }),
  );

  // The entrance end of the hall.
  geometries.push(
    grid(1, 1, (u, v) => [-SHELL_HALF_WIDTH + 2 * SHELL_HALF_WIDTH * u, FLOOR_Y + 20 * v, SHELL_FRONT_Z - MARGIN]),
  );

  return geometries.map((geometry) => new THREE.Mesh(geometry, colliderMaterial));
}
