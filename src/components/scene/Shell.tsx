import { useMemo } from 'react';
import * as THREE from 'three';
import { makeConcrete } from './textures';
import {
  FLOOR_Y,
  SEAM_HALF_WIDTH,
  SHELL_FRONT_Z,
  SHELL_HALF_WIDTH,
  shellBackZ,
  shellY,
  wallZ,
} from './layout';

const U_SEGMENTS = 120;
const V_SEGMENTS = 96;
const RIM_RADIUS = 0.2;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * One wing of the vault as a parametric surface, from the skylight seam (u = 0) to the outer pier
 * line (u = 1), and from the window wall (v = 0) toward the entrance (v = 1). The surface faces down.
 * Vertex colours carry baked ambient occlusion: darker in the seam valley, the low outer edge and
 * where the wing lifts tight against the glass.
 */
function makeWingGeometry(side: -1 | 1): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= V_SEGMENTS; j += 1) {
    const v = j / V_SEGMENTS;
    for (let i = 0; i <= U_SEGMENTS; i += 1) {
      const u = i / U_SEGMENTS;
      const ax = SEAM_HALF_WIDTH + (SHELL_HALF_WIDTH - SEAM_HALF_WIDTH) * u;
      const x = side * ax;
      // Denser rows near the glass, where the curvature is tightest.
      const zBack = shellBackZ(x);
      const z = zBack + (SHELL_FRONT_Z - zBack) * v ** 1.35;
      const y = shellY(x, z);
      positions.push(x, y, z);
      uvs.push(x / 7, z / 7);
      const seamOcclusion = smoothstep(0, 0.16, u);
      const edgeOcclusion = 1 - smoothstep(0.84, 1, u) * 0.35;
      const lipOcclusion = 1 - (1 - smoothstep(0, 0.03, v)) * 0.25;
      const ao = 0.62 + 0.38 * seamOcclusion * edgeOcclusion * lipOcclusion;
      colors.push(ao, ao, ao);
    }
  }
  const row = U_SEGMENTS + 1;
  for (let j = 0; j < V_SEGMENTS; j += 1) {
    for (let i = 0; i < U_SEGMENTS; i += 1) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      // Winding chosen so the normal points down into the hall on both wings.
      if (side > 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A thick, rounded concrete lip along the wing's leading edge and outer edge. */
function makeRimGeometry(side: -1 | 1): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i += 1) {
    const u = i / 80;
    const x = side * (SEAM_HALF_WIDTH + (SHELL_HALF_WIDTH - SEAM_HALF_WIDTH) * u);
    const z = shellBackZ(x);
    points.push(new THREE.Vector3(x, shellY(x, z) + RIM_RADIUS * 0.4, z));
  }
  for (let i = 1; i <= 40; i += 1) {
    const x = side * SHELL_HALF_WIDTH;
    const z0 = shellBackZ(x);
    const z = z0 + (SHELL_FRONT_Z - z0) * (i / 40);
    points.push(new THREE.Vector3(x, shellY(x, z) + RIM_RADIUS * 0.4, z));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, 240, RIM_RADIUS, 10, false);
}

/** Skylight ribbon in the seam between the wings, with glazing bars. */
function makeSkylightGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 80;
  for (let j = 0; j <= segments; j += 1) {
    const x0 = SEAM_HALF_WIDTH;
    const z0 = shellBackZ(x0);
    const z = z0 + (SHELL_FRONT_Z - z0) * (j / segments);
    const y = shellY(x0, z) + 0.12;
    positions.push(-SEAM_HALF_WIDTH - 0.05, y, z, SEAM_HALF_WIDTH + 0.05, y, z);
  }
  for (let j = 0; j < segments; j += 1) {
    const a = j * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A sculpted pier that flares from a slender base into the underside of the shell. */
function makePierGeometry(height: number): THREE.LatheGeometry {
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 32; i += 1) {
    const t = i / 32;
    const radius = 0.42 + 0.1 * Math.sin(t * Math.PI) * -1 + 1.5 * t ** 3.2;
    profile.push(new THREE.Vector2(Math.max(0.3, radius), t * height));
  }
  return new THREE.LatheGeometry(profile, 48);
}

export default function Shell() {
  const concrete = useMemo(() => makeConcrete([1, 1]), []);
  const wings = useMemo(() => [makeWingGeometry(-1), makeWingGeometry(1)], []);
  const rims = useMemo(() => [makeRimGeometry(-1), makeRimGeometry(1)], []);
  const skylight = useMemo(makeSkylightGeometry, []);
  const piers = useMemo(
    () =>
      ([-1, 1] as const).map((side) => {
        const x = side * (SHELL_HALF_WIDTH - 1.4);
        const z = wallZ(x) + 1.3;
        const top = shellY(x, z) + 0.2;
        return { x, z, geometry: makePierGeometry(top - FLOOR_Y) };
      }),
    [],
  );
  const glazingBars = useMemo(() => {
    const bars: { y: number; z: number }[] = [];
    const z0 = shellBackZ(SEAM_HALF_WIDTH);
    for (let z = z0 + 0.8; z < SHELL_FRONT_Z; z += 2.6) bars.push({ y: shellY(SEAM_HALF_WIDTH, z) + 0.08, z });
    return bars;
  }, []);

  return (
    <group>
      {wings.map((geometry, index) => (
        <mesh key={index} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            vertexColors
            map={concrete.map}
            normalMap={concrete.normalMap}
            normalScale={new THREE.Vector2(0.45, 0.45)}
            roughnessMap={concrete.roughnessMap}
            roughness={1}
            metalness={0}
            envMapIntensity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {rims.map((geometry, index) => (
        <mesh key={index} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            map={concrete.map}
            normalMap={concrete.normalMap}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            roughness={0.88}
            color="#F4F1EA"
          />
        </mesh>
      ))}
      <mesh geometry={skylight}>
        <meshBasicMaterial color="#F4FAFF" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {glazingBars.map(({ y, z }) => (
        <mesh key={z} position={[0, y, z]}>
          <boxGeometry args={[SEAM_HALF_WIDTH * 2 + 0.12, 0.05, 0.06]} />
          <meshStandardMaterial color="#4B5559" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {piers.map(({ x, z, geometry }) => (
        <mesh key={x} geometry={geometry} position={[x, FLOOR_Y, z]} castShadow receiveShadow>
          <meshStandardMaterial
            map={concrete.map}
            normalMap={concrete.normalMap}
            roughnessMap={concrete.roughnessMap}
            color="#F2EFE8"
          />
        </mesh>
      ))}
    </group>
  );
}
