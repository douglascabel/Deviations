import { useMemo } from 'react';
import * as THREE from 'three';
import { makeCarpet, makeConcrete } from './textures';
import { BALCONY, FLIGHT_TUBE, FLOOR_Y, SHELL_FRONT_Z, SHELL_HALF_WIDTH, glassTop, shellY, wallZ } from './layout';

/*
 * The hall's flanks, after Saarinen's interior: a white sculpted wall that rises to meet the edge
 * of the shell and follows the rake of the glass at the back, a cove where it meets the carpet,
 * an upper balcony with a rounded parapet, and an oval portal into a red-carpeted flight tube.
 * Every outline is derived from the shared layout, so the wall closes exactly against the glass,
 * the shell and the floor.
 */

const COVE_RADIUS = 0.55;

/** Arch outline of the flight-tube portal in wall coordinates (z, y), from floor to floor. */
function portalArch(segments = 32): [number, number][] {
  const { z0, z1, springHeight, crownHeight } = FLIGHT_TUBE;
  const centre = (z0 + z1) / 2;
  const halfWidth = (z1 - z0) / 2;
  const points: [number, number][] = [[z0, FLOOR_Y], [z0, FLOOR_Y + springHeight]];
  for (let index = 1; index < segments; index += 1) {
    const angle = Math.PI - (index / segments) * Math.PI;
    points.push([
      centre + Math.cos(angle) * halfWidth,
      FLOOR_Y + springHeight + Math.sin(angle) * (crownHeight - springHeight),
    ]);
  }
  points.push([z1, FLOOR_Y + springHeight], [z1, FLOOR_Y]);
  return points;
}

/** Wall outline in (z, y): along the floor (notched by the portal), up the front, along the shell, down the glass. */
function makeWallGeometry(): THREE.ShapeGeometry {
  const x = SHELL_HALF_WIDTH;
  const baseZ = wallZ(x);
  const top = glassTop(x);
  const shape = new THREE.Shape();
  shape.moveTo(baseZ, FLOOR_Y);
  for (const [z, y] of portalArch()) shape.lineTo(z, y);
  shape.lineTo(SHELL_FRONT_Z, FLOOR_Y);
  // Overlap the shell edge slightly so no sliver of sky shows at the junction.
  for (let index = 0; index <= 80; index += 1) {
    const z = SHELL_FRONT_Z + (top.z - SHELL_FRONT_Z) * (index / 80);
    shape.lineTo(z, shellY(x, z) + 0.35);
  }
  shape.lineTo(top.z, top.y);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 24);
  // World-space UVs keep the concrete texture at a consistent scale.
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let index = 0; index < position.count; index += 1) {
    uv.setXY(index, position.getX(index) / 7, position.getY(index) / 7);
  }
  return geometry;
}

/** Concave quarter-round fillet between wall and floor, for one run of wall along z. */
function makeCoveGeometry(length: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, COVE_RADIUS);
  shape.absarc(COVE_RADIUS, COVE_RADIUS, COVE_RADIUS, Math.PI, Math.PI * 1.5, false);
  shape.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 16 });
}

/**
 * Balcony section in (inward distance from wall, height above floor): a soffit that sweeps out of
 * the wall, a deck, and an upturned parapet with a rounded cap.
 */
function makeBalconyGeometry(): THREE.ExtrudeGeometry {
  const { depth, deckHeight } = BALCONY;
  const shape = new THREE.Shape();
  shape.moveTo(0, deckHeight - 1.15);
  shape.bezierCurveTo(0.9, deckHeight - 1.0, depth - 0.2, deckHeight - 0.45, depth + 0.05, deckHeight - 0.08);
  shape.lineTo(depth + 0.08, deckHeight + 0.9);
  shape.absarc(depth - 0.08, deckHeight + 0.9, 0.16, 0, Math.PI, false);
  shape.lineTo(depth - 0.26, deckHeight + 0.06);
  shape.lineTo(0, deckHeight + 0.06);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: BALCONY.z1 - BALCONY.z0,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.12,
    bevelSegments: 8,
    curveSegments: 24,
  });
}

/** The interior of the flight tube: the portal arch swept outward from the wall. */
function makeTubeGeometry(): THREE.BufferGeometry {
  const arch = portalArch(40);
  const steps = 24;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const x = (step / steps) * FLIGHT_TUBE.length;
    for (const [z, y] of arch) positions.push(x, y, z);
  }
  const row = arch.length;
  for (let step = 0; step < steps; step += 1) {
    for (let index = 0; index < row - 1; index += 1) {
      const a = step * row + index;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Flank({ side, resources }: { side: -1 | 1; resources: ReturnType<typeof useFlankResources> }) {
  const { wall, coves, balcony, tube, materials } = resources;
  // All parts are authored for the right-hand wall (inward = -x) and mirrored for the left.
  const mirror: [number, number, number] = [side, 1, 1];
  const tubeWidth = FLIGHT_TUBE.z1 - FLIGHT_TUBE.z0;
  return (
    <group scale={mirror}>
      {/* Wall plane: the shape's x axis is world z. */}
      <mesh geometry={wall} material={materials.wall} position={[SHELL_HALF_WIDTH, 0, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow />
      {coves.map(({ geometry, z0 }) => (
        <mesh
          key={z0}
          geometry={geometry}
          material={materials.wall}
          position={[SHELL_HALF_WIDTH, FLOOR_Y, z0]}
          scale={[-1, 1, 1]}
          receiveShadow
        />
      ))}
      <group position={[SHELL_HALF_WIDTH, FLOOR_Y, BALCONY.z0]} scale={[-1, 1, 1]}>
        <mesh geometry={balcony} material={materials.wall} castShadow receiveShadow />
        <mesh
          material={materials.carpet}
          position={[(BALCONY.depth - 0.3) / 2, BALCONY.deckHeight + 0.07, (BALCONY.z1 - BALCONY.z0) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[BALCONY.depth - 0.3, BALCONY.z1 - BALCONY.z0]} />
        </mesh>
      </group>
      <group position={[SHELL_HALF_WIDTH, 0, 0]}>
        <mesh geometry={tube} material={materials.tube} />
        <mesh
          material={materials.carpet}
          position={[FLIGHT_TUBE.length / 2, FLOOR_Y + 0.015, (FLIGHT_TUBE.z0 + FLIGHT_TUBE.z1) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[FLIGHT_TUBE.length, tubeWidth]} />
        </mesh>
        {/* Daylight at the far end of the tube. */}
        <mesh
          position={[FLIGHT_TUBE.length - 0.05, FLOOR_Y + FLIGHT_TUBE.crownHeight / 2, (FLIGHT_TUBE.z0 + FLIGHT_TUBE.z1) / 2]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <planeGeometry args={[tubeWidth, FLIGHT_TUBE.crownHeight]} />
          <meshBasicMaterial color="#FFF8EA" toneMapped={false} />
        </mesh>
        {/* Recessed lighting strip along the crown of the tube. */}
        <mesh position={[FLIGHT_TUBE.length / 2, FLOOR_Y + FLIGHT_TUBE.crownHeight - 0.06, (FLIGHT_TUBE.z0 + FLIGHT_TUBE.z1) / 2]}>
          <boxGeometry args={[FLIGHT_TUBE.length - 1, 0.04, 0.22]} />
          <meshBasicMaterial color="#FFF1D6" toneMapped={false} />
        </mesh>
      </group>
      {/* Warm spill from the tube portal onto the hall floor. */}
      <pointLight
        position={[SHELL_HALF_WIDTH - 1.2, FLOOR_Y + 2.2, (FLIGHT_TUBE.z0 + FLIGHT_TUBE.z1) / 2]}
        intensity={6}
        distance={9}
        decay={2}
        color="#FFE9C8"
      />
    </group>
  );
}

function useFlankResources() {
  return useMemo(() => {
    const concrete = makeConcrete([1, 1]);
    const carpet = makeCarpet([4, 4]);
    const baseZ = wallZ(SHELL_HALF_WIDTH);
    const coveRuns = [
      { z0: baseZ, z1: FLIGHT_TUBE.z0 },
      { z0: FLIGHT_TUBE.z1, z1: SHELL_FRONT_Z },
    ];
    return {
      wall: makeWallGeometry(),
      coves: coveRuns.map(({ z0, z1 }) => ({ z0, geometry: makeCoveGeometry(z1 - z0) })),
      balcony: makeBalconyGeometry(),
      tube: makeTubeGeometry(),
      materials: {
        wall: new THREE.MeshStandardMaterial({
          color: '#F2EFE8',
          map: concrete.map,
          normalMap: concrete.normalMap,
          normalScale: new THREE.Vector2(0.35, 0.35),
          roughnessMap: concrete.roughnessMap,
          roughness: 0.95,
          side: THREE.DoubleSide,
        }),
        tube: new THREE.MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.55, side: THREE.DoubleSide }),
        carpet: new THREE.MeshStandardMaterial({
          map: carpet.map,
          normalMap: carpet.normalMap,
          roughnessMap: carpet.roughnessMap,
          roughness: 1,
        }),
      },
    };
  }, []);
}

export default function SideWalls() {
  const resources = useFlankResources();
  return (
    <group>
      <Flank side={1} resources={resources} />
      <Flank side={-1} resources={resources} />
    </group>
  );
}
