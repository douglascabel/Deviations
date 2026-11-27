import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FLOOR_Y, SHELL_HALF_WIDTH, glassTop, wallZ } from './layout';

const BAYS = 14;
const COLUMNS_PER_BAY = 4;
const TRANSOM_HEIGHTS = [FLOOR_Y + 0.32, -2.2, 1.9, 6.4, 10.6];

interface Mullion {
  from: THREE.Vector3;
  to: THREE.Vector3;
  thickness: number;
  depth: number;
}

function basePoint(x: number): THREE.Vector3 {
  return new THREE.Vector3(x, FLOOR_Y, wallZ(x));
}

function topPoint(x: number): THREE.Vector3 {
  const top = glassTop(x);
  return new THREE.Vector3(x, top.y, top.z);
}

/** Point on the raked mullion line at x, at height y (null above the glass). */
function pointAtHeight(x: number, y: number): THREE.Vector3 | null {
  const bottom = basePoint(x);
  const top = topPoint(x);
  if (y > top.y - 0.15) return null;
  const t = (y - bottom.y) / (top.y - bottom.y);
  return bottom.lerp(top, t);
}

/** All the panes as one surface whose top edge follows the underside of the shell. */
function makeGlassGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const columns = BAYS * COLUMNS_PER_BAY;
  for (let i = 0; i <= columns; i += 1) {
    const x = -SHELL_HALF_WIDTH + (2 * SHELL_HALF_WIDTH * i) / columns;
    const bottom = basePoint(x);
    const top = topPoint(x);
    positions.push(bottom.x, bottom.y, bottom.z, top.x, top.y, top.z);
  }
  for (let i = 0; i < columns; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeMullions(): Mullion[] {
  const mullions: Mullion[] = [];
  for (let i = 0; i <= BAYS; i += 1) {
    const x = -SHELL_HALF_WIDTH + (2 * SHELL_HALF_WIDTH * i) / BAYS;
    mullions.push({ from: basePoint(x), to: topPoint(x), thickness: 0.09, depth: 0.32 });
  }
  for (let bay = 0; bay < BAYS; bay += 1) {
    const x0 = -SHELL_HALF_WIDTH + (2 * SHELL_HALF_WIDTH * bay) / BAYS;
    const x1 = -SHELL_HALF_WIDTH + (2 * SHELL_HALF_WIDTH * (bay + 1)) / BAYS;
    for (const y of TRANSOM_HEIGHTS) {
      const from = pointAtHeight(x0, y);
      const to = pointAtHeight(x1, y);
      if (from && to) mullions.push({ from, to, thickness: y === TRANSOM_HEIGHTS[0] ? 0.5 : 0.07, depth: 0.22 });
    }
  }
  return mullions;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const up = new THREE.Vector3(0, 1, 0);

export default function GlassWall() {
  const glass = useMemo(makeGlassGeometry, []);
  const mullions = useMemo(makeMullions, []);
  const frames = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = frames.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const direction = new THREE.Vector3();
    const middle = new THREE.Vector3();
    const scale = new THREE.Vector3();
    mullions.forEach(({ from, to, thickness, depth }, index) => {
      direction.subVectors(to, from);
      const length = direction.length();
      direction.normalize();
      quaternion.setFromUnitVectors(up, direction);
      middle.addVectors(from, to).multiplyScalar(0.5);
      scale.set(thickness, length, depth);
      matrix.compose(middle, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [mullions]);

  return (
    <group>
      <mesh geometry={glass} renderOrder={2}>
        <meshPhysicalMaterial
          color="#6E9C88"
          metalness={0}
          roughness={0.03}
          transparent
          opacity={0.2}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={2.2}
          specularIntensity={1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <instancedMesh ref={frames} args={[unitBox, undefined, mullions.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#3E474A" metalness={0.75} roughness={0.32} />
      </instancedMesh>
    </group>
  );
}
