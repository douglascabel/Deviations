import { useMemo } from 'react';
import * as THREE from 'three';

/*
 * A four-engine, swept-wing jetliner of the early-1960s type seen from the TWA terminal.
 * Local axes: nose toward -x, up +y, right wing toward +z. The origin is on the ground beneath the
 * nose-gear/main-gear line, so placing the group on the apron grounds every tyre exactly.
 * The livery is generic (white crown, red cheatline, bare-metal belly) and carries no airline marks.
 */

const LENGTH = 46;
const RADIUS = 1.88;
/** Height of the fuselage centreline above the ground, set by the gear. */
const CENTRELINE = 3.4;
const NOSE_X = -LENGTH / 2;

/** Fuselage radius at distance l from the nose. */
function fuselageRadius(l: number): number {
  if (l <= 7) return RADIUS * Math.sqrt(1 - (1 - l / 7) ** 2.4);
  if (l <= 33) return RADIUS;
  const t = Math.min(1, (l - 33) / 13);
  return Math.max(0.22, RADIUS * (1 - t ** 1.55));
}

/** The tail sweeps upward toward the fin. */
function upsweep(l: number): number {
  return l > 29 ? 1.15 * ((l - 29) / 17) ** 2 : 0;
}

const AROUND = 48;
const ALONG = 92;

function makeFuselageGeometry(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [];
  for (let index = 0; index <= ALONG; index += 1) {
    const l = (index / ALONG) * LENGTH;
    profile.push(new THREE.Vector2(index === 0 || index === ALONG ? 0.0001 : fuselageRadius(l), l));
  }
  // Lathe around Y, then lay the Y axis along -x -> +x (nose first).
  const geometry = new THREE.LatheGeometry(profile, AROUND).rotateZ(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const l = position.getX(index);
    position.setX(index, l + NOSE_X);
    position.setY(index, position.getY(index) + upsweep(l));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Livery painted in lathe UV space: u runs around the fuselage, v from nose (0) to tail (1).
 * After rotation, elevation e above the side on the +z side sits at u = 1 - e / 2pi, and on the
 * -z side at u = 0.5 + e / 2pi; the crown is u = 0.75 and the belly u = 0.25.
 */
function makeLiveryTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to paint the airliner livery.');
  const yFor = (l: number) => (1 - l / LENGTH) * height;
  const both = (e0: number, e1: number, draw: (x0: number, x1: number) => void) => {
    // +z side
    draw((1 - e1 / (Math.PI * 2)) * width, (1 - e0 / (Math.PI * 2)) * width);
    // -z side
    draw((0.5 + e0 / (Math.PI * 2)) * width, (0.5 + e1 / (Math.PI * 2)) * width);
  };

  // Bare-metal belly, white crown.
  context.fillStyle = '#C3C7CA';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#F4F4F0';
  context.fillRect(0.5 * width - 0.02 * width, 0, 0.52 * width, height);
  both(-0.05, 0.2, (x0, x1) => {
    context.fillStyle = '#F4F4F0';
    context.fillRect(x0, 0, x1 - x0, height);
  });
  // Red cheatline and pinstripe, from just behind the nose cone to the tail.
  both(-0.06, 0.09, (x0, x1) => {
    context.fillStyle = '#B3202E';
    context.fillRect(x0, yFor(43), x1 - x0, yFor(2.2) - yFor(43));
  });
  both(0.34, 0.37, (x0, x1) => {
    context.fillStyle = '#B3202E';
    context.fillRect(x0, yFor(40), x1 - x0, yFor(6) - yFor(40));
  });
  // Cabin windows.
  context.fillStyle = '#1B2127';
  for (let l = 8.6; l < 36.5; l += 0.54) {
    both(0.15, 0.29, (x0, x1) => {
      const y = yFor(l);
      context.beginPath();
      context.roundRect(x0, y - 4, x1 - x0, 7, 3);
      context.fill();
    });
  }
  // Cockpit side windows and windscreen.
  for (const [l0, l1] of [[3.2, 3.9], [4.0, 4.7], [4.8, 5.4]]) {
    both(0.3, 0.62, (x0, x1) => context.fillRect(x0, yFor(l1), x1 - x0, yFor(l0) - yFor(l1)));
  }
  context.fillRect(0.72 * width, yFor(3.3), 0.06 * width, yFor(2.4) - yFor(3.3));
  // Door outlines.
  context.strokeStyle = 'rgba(40, 45, 50, 0.55)';
  context.lineWidth = 2;
  for (const l of [6.6, 39.2]) {
    both(-0.15, 0.5, (x0, x1) => context.strokeRect(x0, yFor(l + 0.9), x1 - x0, yFor(l) - yFor(l + 0.9)));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A swept, tapered lifting surface with thickness, built in the x-z plane (span toward +-z). */
function makeSurface(span: number, rootChord: number, tipChord: number, sweep: number, thickness: number, side: 1 | -1) {
  const tipLe = span * Math.tan(sweep);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(tipLe, side * span);
  shape.lineTo(tipLe + tipChord, side * span);
  shape.lineTo(rootChord, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: thickness * 0.3,
    bevelSegments: 3,
  })
    .rotateX(Math.PI / 2)
    .translate(0, thickness / 2, 0);
}

function makeFin(): THREE.ExtrudeGeometry {
  const height = 7.4;
  const root = 8.4;
  const tip = 2.6;
  const tipLe = height * Math.tan(THREE.MathUtils.degToRad(40));
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(tipLe, height);
  shape.lineTo(tipLe + tip, height);
  shape.lineTo(root, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 3,
  }).translate(0, 0, -0.15);
}

function makeNacelle(): THREE.LatheGeometry {
  const points: [number, number][] = [
    [0.6, 0],
    [0.76, 0.12],
    [0.82, 0.6],
    [0.8, 3.2],
    [0.66, 4.6],
    [0.5, 5.2],
    [0.42, 5.2],
  ];
  return new THREE.LatheGeometry(
    points.map(([r, l]) => new THREE.Vector2(r, l)),
    32,
  ).rotateZ(-Math.PI / 2);
}

const WING = {
  rootX: -6.6,
  rootZ: 1.5,
  span: 20.4,
  rootChord: 9.2,
  tipChord: 2.2,
  sweep: THREE.MathUtils.degToRad(35),
  y: -1.15,
  dihedral: THREE.MathUtils.degToRad(6),
};
const ENGINE_SPANS = [5.8, 11.4];
const WHEEL_RADIUS = 0.58;

function wingLeadingEdge(spanFromRoot: number): { x: number; y: number } {
  return {
    x: WING.rootX + spanFromRoot * Math.tan(WING.sweep),
    y: WING.y + spanFromRoot * Math.tan(WING.dihedral),
  };
}

interface AirlinerResources {
  fuselage: THREE.BufferGeometry;
  wings: THREE.BufferGeometry[];
  stabilisers: THREE.BufferGeometry[];
  fin: THREE.BufferGeometry;
  nacelle: THREE.BufferGeometry;
  materials: Record<'paint' | 'metal' | 'engine' | 'fan' | 'exhaust' | 'rubber' | 'gear' | 'red', THREE.Material>;
}

let shared: AirlinerResources | null = null;
function resources(): AirlinerResources {
  if (shared) return shared;
  shared = {
    fuselage: makeFuselageGeometry(),
    wings: ([1, -1] as const).map((side) =>
      makeSurface(WING.span, WING.rootChord, WING.tipChord, WING.sweep, 0.42, side),
    ),
    stabilisers: ([1, -1] as const).map((side) => makeSurface(6.6, 4.2, 1.5, THREE.MathUtils.degToRad(35), 0.24, side)),
    fin: makeFin(),
    nacelle: makeNacelle(),
    materials: {
      paint: new THREE.MeshPhysicalMaterial({
        map: makeLiveryTexture(),
        roughness: 0.32,
        metalness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      }),
      metal: new THREE.MeshStandardMaterial({ color: '#C8CCCE', metalness: 0.85, roughness: 0.32 }),
      engine: new THREE.MeshStandardMaterial({ color: '#B9BDBF', metalness: 0.8, roughness: 0.28, side: THREE.DoubleSide }),
      fan: new THREE.MeshStandardMaterial({ color: '#202428', metalness: 0.6, roughness: 0.4 }),
      exhaust: new THREE.MeshStandardMaterial({ color: '#4A4440', metalness: 0.7, roughness: 0.5 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 }),
      gear: new THREE.MeshStandardMaterial({ color: '#8E9396', metalness: 0.7, roughness: 0.35 }),
      red: new THREE.MeshPhysicalMaterial({ color: '#B3202E', roughness: 0.35, clearcoat: 0.6 }),
    },
  };
  return shared;
}

function Wheel({ position }: { position: [number, number, number] }) {
  const { materials } = resources();
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh material={materials.rubber} castShadow>
        <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.36, 24]} />
      </mesh>
      <mesh material={materials.gear}>
        <cylinderGeometry args={[WHEEL_RADIUS * 0.55, WHEEL_RADIUS * 0.55, 0.38, 16]} />
      </mesh>
    </group>
  );
}

/** A strut from (x, top) straight down to an axle at wheel height, with wheels at the given z offsets. */
function GearLeg({ x, z, top, axles, wheelZ }: { x: number; z: number; top: number; axles: number[]; wheelZ: number[] }) {
  const { materials } = resources();
  const axleY = WHEEL_RADIUS;
  return (
    <group position={[x, 0, z]}>
      <mesh material={materials.gear} position={[0, (top + axleY + 0.3) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, top - axleY - 0.3, 12]} />
      </mesh>
      {axles.length > 1 ? (
        <mesh material={materials.gear} position={[0, axleY + 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.09, Math.abs(axles[axles.length - 1] - axles[0]) + 0.3, 10]} />
        </mesh>
      ) : null}
      {axles.map((ax) =>
        wheelZ.map((wz) => <Wheel key={`${ax}-${wz}`} position={[ax, axleY, wz]} />),
      )}
    </group>
  );
}

export default function Airliner(props: JSX.IntrinsicElements['group']) {
  const parts = resources();
  const { materials } = parts;
  const engines = useMemo(
    () =>
      ENGINE_SPANS.flatMap((span) =>
        ([1, -1] as const).map((side) => {
          const edge = wingLeadingEdge(span);
          return { side, span, x: edge.x - 2.4, y: edge.y - 1.25, z: side * (WING.rootZ + span) };
        }),
      ),
    [],
  );
  const finLength = 33.8;

  return (
    <group {...props}>
      <group position={[0, CENTRELINE, 0]}>
        <mesh geometry={parts.fuselage} material={materials.paint} castShadow receiveShadow />

        {parts.wings.map((geometry, index) => {
          const side = index === 0 ? 1 : -1;
          return (
            <mesh
              key={side}
              geometry={geometry}
              material={materials.metal}
              position={[WING.rootX, WING.y, side * WING.rootZ]}
              // Positive X rotation would droop a +z wingtip; negate so both tips rise.
              rotation={[-side * WING.dihedral, 0, 0]}
              castShadow
              receiveShadow
            />
          );
        })}
        {/* Wing-to-body fairing. */}
        <mesh material={materials.metal} position={[WING.rootX + 4.4, WING.y + 0.1, 0]} scale={[5.6, 0.9, 1.65]}>
          <sphereGeometry args={[1, 24, 12]} />
        </mesh>

        {parts.stabilisers.map((geometry, index) => {
          const side = index === 0 ? 1 : -1;
          return (
            <mesh
              key={side}
              geometry={geometry}
              material={materials.metal}
              position={[NOSE_X + 40, upsweep(40) + 0.25, side * 0.5]}
              rotation={[-side * THREE.MathUtils.degToRad(4), 0, 0]}
              castShadow
            />
          );
        })}
        <mesh geometry={parts.fin} material={materials.red} position={[NOSE_X + finLength, upsweep(finLength) + 1.0, 0]} castShadow />

        {engines.map(({ side, span, x, y, z }) => (
          <group key={`${side}-${span}`} position={[x, y, z]}>
            <mesh geometry={parts.nacelle} material={materials.engine} castShadow />
            <mesh material={materials.fan} position={[0.08, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <circleGeometry args={[0.62, 24]} />
            </mesh>
            <mesh material={materials.exhaust} position={[5.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.36, 0.9, 20]} />
            </mesh>
            {/* Swept pylon up into the wing's underside. */}
            <mesh material={materials.metal} position={[2.7, 0.92, 0]}>
              <boxGeometry args={[3.2, 0.62, 0.2]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Gear: tyres touch y = 0. */}
      <GearLeg x={NOSE_X + 4.6} z={0} top={CENTRELINE - RADIUS + 0.4} axles={[0]} wheelZ={[-0.3, 0.3]} />
      {([1, -1] as const).map((side) => (
        <GearLeg
          key={side}
          x={WING.rootX + 6.4}
          z={side * 3.5}
          top={CENTRELINE + WING.y}
          axles={[-0.75, 0.75]}
          wheelZ={[-0.42, 0.42]}
        />
      ))}
    </group>
  );
}

export const AIRLINER_FOOTPRINT = { length: LENGTH, span: 2 * (WING.rootZ + WING.span) };
