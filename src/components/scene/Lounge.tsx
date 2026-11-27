import { useMemo } from 'react';
import * as THREE from 'three';
import { makeCarpet, makeConcrete, makeUpholstery } from './textures';
import { FLOOR_Y, LOUNGES, SHELL_FRONT_Z, SHELL_HALF_WIDTH, wallZ } from './layout';

const BENCH_ARC = Math.PI * 1.7;
const WELL_FLOOR = 0.1;

/*
 * Each lounge is a sculpted island: a white concrete rim, undercut at the base so it reads as
 * cantilevered while still bearing on the floor, enclosing a carpeted well with a continuous
 * upholstered bench and a pedestal table. All parts are lathed from one radius, so they share a
 * centre, a floor plane and a scale.
 */

function rimProfile(radius: number): THREE.Vector2[] {
  const points: [number, number][] = [
    [radius - 0.42, 0],
    [radius - 0.3, 0.05],
    [radius - 0.12, 0.2],
    [radius, 0.4],
    [radius - 0.02, 0.52],
    [radius - 0.12, 0.6],
    [radius - 0.32, 0.6],
    [radius - 0.42, 0.54],
    [radius - 0.46, 0.3],
    [radius - 0.48, WELL_FLOOR],
  ];
  return points.map(([r, y]) => new THREE.Vector2(r, y));
}

/** Bench cross-section: seat cushion with a rolled front edge, and a raked back. */
function benchProfile(radius: number): THREE.Vector2[] {
  const inner = radius - 1.32;
  const outer = radius - 0.48;
  const points: [number, number][] = [
    [inner + 0.04, WELL_FLOOR],
    [inner, WELL_FLOOR + 0.2],
    [inner + 0.02, WELL_FLOOR + 0.36],
    [inner + 0.1, WELL_FLOOR + 0.42],
    [outer - 0.38, WELL_FLOOR + 0.44],
    [outer - 0.3, WELL_FLOOR + 0.5],
    [outer - 0.22, WELL_FLOOR + 0.86],
    [outer - 0.14, WELL_FLOOR + 0.96],
    [outer - 0.02, WELL_FLOOR + 0.96],
    [outer, WELL_FLOOR + 0.9],
    [outer, WELL_FLOOR],
  ];
  return points.map(([r, y]) => new THREE.Vector2(r, y));
}

function tableProfile(): THREE.Vector2[] {
  const points: [number, number][] = [
    [0.001, WELL_FLOOR],
    [0.34, WELL_FLOOR],
    [0.32, WELL_FLOOR + 0.03],
    [0.1, WELL_FLOOR + 0.12],
    [0.05, WELL_FLOOR + 0.28],
    [0.06, WELL_FLOOR + 0.4],
    [0.2, WELL_FLOOR + 0.48],
    [0.56, WELL_FLOOR + 0.5],
    [0.56, WELL_FLOOR + 0.53],
    [0.001, WELL_FLOOR + 0.53],
  ];
  return points.map(([r, y]) => new THREE.Vector2(r, y));
}

/** A flat cap closing one end of the bench arc, at angle phi around the lathe axis. */
function benchCap(profile: THREE.Vector2[], phi: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(profile);
  const geometry = new THREE.ShapeGeometry(shape, 6);
  geometry.rotateY(phi - Math.PI / 2);
  return geometry;
}

interface LoungeIslandProps {
  x: number;
  z: number;
  rotation: number;
  radius: number;
  materials: LoungeMaterials;
}

interface LoungeMaterials {
  rim: THREE.Material;
  carpet: THREE.Material;
  upholstery: THREE.Material;
  table: THREE.Material;
}

function LoungeIsland({ x, z, rotation, radius, materials }: LoungeIslandProps) {
  const geometries = useMemo(() => {
    const bench = benchProfile(radius);
    const phiStart = Math.PI - BENCH_ARC / 2;
    return {
      rim: new THREE.LatheGeometry(rimProfile(radius), 128),
      bench: new THREE.LatheGeometry(bench, 112, phiStart, BENCH_ARC),
      capStart: benchCap(bench, phiStart),
      capEnd: benchCap(bench, phiStart + BENCH_ARC),
      well: new THREE.CircleGeometry(radius - 0.47, 96).rotateX(-Math.PI / 2).translate(0, WELL_FLOOR, 0),
      table: new THREE.LatheGeometry(tableProfile(), 64),
    };
  }, [radius]);

  return (
    <group position={[x, FLOOR_Y, z]} rotation={[0, rotation, 0]}>
      <mesh geometry={geometries.rim} material={materials.rim} castShadow receiveShadow />
      <mesh geometry={geometries.well} material={materials.carpet} receiveShadow />
      <mesh geometry={geometries.bench} material={materials.upholstery} castShadow receiveShadow />
      <mesh geometry={geometries.capStart} material={materials.upholstery} castShadow />
      <mesh geometry={geometries.capEnd} material={materials.upholstery} castShadow />
      <mesh geometry={geometries.table} material={materials.table} castShadow receiveShadow />
      {/* Steps over the rim and down into the well, through the opening in the bench. */}
      {[
        { r: radius + 0.22, base: 0, height: 0.3 },
        { r: radius - 0.7, base: WELL_FLOOR, height: 0.27 },
        { r: radius - 1.02, base: WELL_FLOOR, height: 0.13 },
      ].map(({ r, base, height }) => (
        <mesh key={r} material={materials.carpet} position={[0, base + height / 2, r]} castShadow receiveShadow>
          <boxGeometry args={[1.1, height, 0.34]} />
        </mesh>
      ))}
    </group>
  );
}

/** The carpeted hall floor, bounded by the window wall, plus the three lounges. */
export default function Lounges() {
  const resources = useMemo(() => {
    const carpet = makeCarpet([26, 26]);
    const wellCarpet = makeCarpet([3, 3]);
    const weave = makeUpholstery([10, 2]);
    const concrete = makeConcrete([2, 1]);

    const floorShape = new THREE.Shape();
    const points: [number, number][] = [];
    for (let i = 0; i <= 64; i += 1) {
      const x = -SHELL_HALF_WIDTH + (2 * SHELL_HALF_WIDTH * i) / 64;
      points.push([x, wallZ(x)]);
    }
    // Shape is built in the XY plane with y = -z, then laid flat.
    floorShape.moveTo(points[0][0], -points[0][1]);
    for (const [x, z] of points.slice(1)) floorShape.lineTo(x, -z);
    floorShape.lineTo(SHELL_HALF_WIDTH, -SHELL_FRONT_Z);
    floorShape.lineTo(-SHELL_HALF_WIDTH, -SHELL_FRONT_Z);
    floorShape.closePath();
    const floor = new THREE.ShapeGeometry(floorShape, 1).rotateX(-Math.PI / 2);
    // World-space UVs so the pile scale is uniform.
    const position = floor.attributes.position;
    const uv = floor.attributes.uv;
    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(index, position.getX(index) / 36, position.getZ(index) / 36);
    }

    const materials: LoungeMaterials = {
      rim: new THREE.MeshStandardMaterial({
        color: '#F3F0E9',
        map: concrete.map,
        normalMap: concrete.normalMap,
        normalScale: new THREE.Vector2(0.25, 0.25),
        roughness: 0.62,
        side: THREE.DoubleSide,
      }),
      carpet: new THREE.MeshStandardMaterial({
        map: wellCarpet.map,
        normalMap: wellCarpet.normalMap,
        roughnessMap: wellCarpet.roughnessMap,
        roughness: 1,
      }),
      upholstery: new THREE.MeshPhysicalMaterial({
        color: '#B51E30',
        normalMap: weave.normalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughnessMap: weave.roughnessMap,
        roughness: 0.85,
        sheen: 1,
        sheenColor: new THREE.Color('#FF6B78'),
        sheenRoughness: 0.45,
        side: THREE.DoubleSide,
      }),
      table: new THREE.MeshPhysicalMaterial({
        color: '#F6F4EF',
        roughness: 0.18,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide,
      }),
    };
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: carpet.map,
      normalMap: carpet.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: carpet.roughnessMap,
      roughness: 1,
      envMapIntensity: 0.6,
    });
    return { floor, floorMaterial, materials };
  }, []);

  return (
    <group>
      <mesh geometry={resources.floor} material={resources.floorMaterial} position={[0, FLOOR_Y, 0]} receiveShadow />
      {LOUNGES.map((lounge, index) => (
        <LoungeIsland key={index} {...lounge} materials={resources.materials} />
      ))}
    </group>
  );
}
