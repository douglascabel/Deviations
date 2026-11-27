import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import flapFontUrl from '@fontsource/jost/files/jost-latin-600-normal.woff?url';
import { playFlap } from '../utils/soundEngine';

/*
 * Split-flap mechanism
 * --------------------
 * Each cell is drawn with four opaque, single-sided leaves that share one material:
 *
 *   topStatic    upper half, fixed       -> shows the INCOMING character as soon as a flap starts to fall
 *   bottomStatic lower half, fixed       -> keeps the OUTGOING character until the flap lands on it
 *   flapFront    upper half, hinged      -> front face of the falling leaf: OUTGOING top half
 *   flapBack     upper half, hinged      -> back face of the falling leaf: INCOMING bottom half
 *
 * The leaf colour and the glyph are composited in one fragment shader (mix(background, ink, atlas)),
 * so there are no separate transparent glyph quads to sort or z-fight. Back faces are culled, and every
 * coplanar pair is separated by >= 1.2 mm, well above the depth-buffer resolution at viewing distance.
 *
 * The hinge sits on the crease. The leaf rotates about X from 0 to 180 degrees (positive X in three.js
 * swings the leaf toward the viewer, as on a real Solari board), accelerating like a body under gravity,
 * then a short damped rebound settles it on the stop.
 */

const CELL_WIDTH = 0.182;
const CELL_HEIGHT = 0.37;
const CREASE_GAP = 0.012;
const LEAF_HEIGHT = (CELL_HEIGHT - CREASE_GAP) / 2;
const LEAF_CENTER_Y = CREASE_GAP / 2 + LEAF_HEIGHT / 2;
const LEAF_THICKNESS = 0.0012;
const HINGE_Z = 0.0062;
const MAX_CELLS = 14 * 42;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const TILE_SIZE = 128;
const CHARACTER_SPOOL = Array.from(' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./:');
const GLYPHS = CHARACTER_SPOOL.join('');
const FLAP_COLOR = '#16171A';
const FLAP_TEXT_COLOR = '#F3F1EA';

/** Fraction of a step spent falling; the rest is the rebound. */
const FALL_FRACTION = 0.74;
/** Peak rebound in radians (about 4.6 degrees). */
const REBOUND_ANGLE = 0.08;

interface SpoolState {
  character: string;
  color: string;
  textColor: string;
}

interface CellDescriptor {
  current: SpoolState;
  target: SpoolState;
  position: [number, number, number];
  pending: SpoolState[];
  nextStepAt: number;
  stepDuration: number;
  active: boolean;
  outgoing: SpoolState;
  incoming: SpoolState;
  stepStartAt: number;
  landed: boolean;
}

interface CellRegistration {
  character: string;
  color: string;
  textColor: string;
  delay: number;
  position: [number, number, number];
}

interface BatchContextValue {
  register: (id: string, cell: CellRegistration) => void;
  unregister: (id: string) => void;
}

interface SplitFlapCharProps {
  id: string;
  character: string;
  color?: string;
  textColor?: string;
  delay?: number;
  position: [number, number, number];
}

const BatchContext = createContext<BatchContextValue | null>(null);

const ATLAS_FALLBACK = '"Aptos", "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';

function drawAtlas(canvas: HTMLCanvasElement, family: string): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the split-flap character atlas.');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = `600 ${Math.round(TILE_SIZE * 0.86)}px ${family}`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  // Centre caps on the crease using the font's cap height, not its em box.
  const metrics = context.measureText('H');
  const capHeight = metrics.actualBoundingBoxAscent;
  for (const [index, glyph] of Array.from(GLYPHS).entries()) {
    if (glyph === ' ') continue;
    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    context.save();
    // Clip to the tile so descenders (J, Q) never bleed into a neighbouring glyph.
    context.beginPath();
    context.rect(column * TILE_SIZE + 2, row * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    context.clip();
    context.translate((column + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE);
    // Tall, slightly condensed caps that fill the leaf, like Solari's stencilled flaps.
    context.scale(0.94, 1.14);
    context.fillText(glyph, 0, capHeight / 2);
    context.restore();
  }
}

function makeAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * TILE_SIZE;
  canvas.height = ATLAS_ROWS * TILE_SIZE;
  drawAtlas(canvas, ATLAS_FALLBACK);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;

  // Redraw with the bundled typeface once it has loaded, so every platform shows the same letters.
  const face = new FontFace('DeviationsFlap', `url(${flapFontUrl})`, { weight: '600' });
  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      drawAtlas(canvas, `"DeviationsFlap", ${ATLAS_FALLBACK}`);
      texture.needsUpdate = true;
    })
    .catch((error: unknown) => console.warn('Split-flap font failed to load; using a system font.', error));
  return texture;
}

function addInstanceAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.setAttribute('aBg', new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS * 3), 3));
  geometry.setAttribute('aFg', new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS * 3), 3));
  geometry.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS * 2), 2));
  return geometry;
}

/**
 * A leaf covering the upper (or lower) half of a cell, in hinge-relative coordinates (crease at y = 0).
 * UVs are tile-local, mapped so the glyph is continuous across the crease gap.
 */
function makeLeafGeometry(upper: boolean, z: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(CELL_WIDTH, LEAF_HEIGHT, 1, 1);
  geometry.translate(0, upper ? LEAF_CENTER_Y : -LEAF_CENTER_Y, z);
  const uv = geometry.attributes.uv;
  const gapFraction = CREASE_GAP / CELL_HEIGHT / 2;
  for (let index = 0; index < uv.count; index += 1) {
    const v = uv.getY(index);
    uv.setY(index, upper ? 0.5 + gapFraction + v * (0.5 - gapFraction) : v * (0.5 - gapFraction));
  }
  uv.needsUpdate = true;
  return geometry;
}

const glyphTexture = makeAtlas();
const topStaticGeometry = addInstanceAttributes(makeLeafGeometry(true, 0));
const bottomStaticGeometry = addInstanceAttributes(makeLeafGeometry(false, 0));
const flapFrontGeometry = addInstanceAttributes(makeLeafGeometry(true, LEAF_THICKNESS));
// The back face is the lower half, pre-rotated onto the upper half so it faces away from the viewer.
// After the flap turns 180 degrees it lands exactly where the lower static leaf is, facing forward.
const flapBackGeometry = addInstanceAttributes(makeLeafGeometry(false, LEAF_THICKNESS).rotateX(Math.PI));
const flapCoreGeometry = new THREE.BoxGeometry(CELL_WIDTH - 0.003, LEAF_HEIGHT - 0.003, LEAF_THICKNESS * 0.6)
  .translate(0, LEAF_CENTER_Y, 0);
const backingGeometry = new THREE.BoxGeometry(CELL_WIDTH + 0.012, CELL_HEIGHT + 0.012, 0.012).translate(0, 0, -0.008);
const hingeGeometry = new THREE.CylinderGeometry(0.0028, 0.0028, CELL_WIDTH - 0.012, 6)
  .rotateZ(Math.PI / 2)
  .translate(0, 0, HINGE_Z * 0.5);

const leafMaterial = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.58,
  metalness: 0.05,
  side: THREE.FrontSide,
});
leafMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uAtlas = { value: glyphTexture };
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
attribute vec3 aBg;
attribute vec3 aFg;
attribute vec2 aGlyph;
varying vec3 vLeafBg;
varying vec3 vLeafFg;
varying vec2 vGlyphUv;`,
    )
    .replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
vLeafBg = aBg;
vLeafFg = aFg;
vGlyphUv = vec2((aGlyph.x + uv.x) / ${ATLAS_COLUMNS.toFixed(1)}, 1.0 - (aGlyph.y + 1.0 - uv.y) / ${ATLAS_ROWS.toFixed(1)});`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
uniform sampler2D uAtlas;
varying vec3 vLeafBg;
varying vec3 vLeafFg;
varying vec2 vGlyphUv;`,
    )
    .replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `float ink = smoothstep(0.32, 0.68, texture2D(uAtlas, vGlyphUv).a);
vec4 diffuseColor = vec4(mix(vLeafBg, vLeafFg, ink), opacity);`,
    )
    .replace(
      'vec3 totalEmissiveRadiance = emissive;',
      // A touch of self-illumination keeps the ink legible under the dark housing.
      'vec3 totalEmissiveRadiance = emissive + diffuseColor.rgb * 0.16;',
    );
};
leafMaterial.customProgramCacheKey = () => 'split-flap-leaf-v3';

const flapCoreMaterial = new THREE.MeshStandardMaterial({
  color: '#0D0E10',
  roughness: 0.7,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
});
const backingMaterial = new THREE.MeshStandardMaterial({ color: '#08090A', roughness: 0.85, metalness: 0.1 });
const hingeMaterial = new THREE.MeshStandardMaterial({ color: '#1C1F23', roughness: 0.55, metalness: 0.6 });

const glyphIndex = new Map(Array.from(GLYPHS, (glyph, index) => [glyph, index]));
const colorCache = new Map<string, THREE.Color>();
function linearColor(value: string): THREE.Color {
  let color = colorCache.get(value);
  if (!color) {
    color = new THREE.Color(value);
    colorCache.set(value, color);
  }
  return color;
}

function spoolFor(color: string, textColor: string): SpoolState[] {
  return CHARACTER_SPOOL.map((character) => ({ character, color, textColor }));
}

function sameState(a: SpoolState, b: SpoolState): boolean {
  return a.character === b.character && a.color === b.color && a.textColor === b.textColor;
}

/** The drum only turns forward, so the path to the target is every leaf after the current one. */
function forwardSteps(current: SpoolState, target: SpoolState): SpoolState[] {
  const from = CHARACTER_SPOOL.indexOf(current.character);
  const to = CHARACTER_SPOOL.indexOf(target.character);
  if (from < 0 || to < 0) return [target];
  if (from === to) return sameState(current, target) ? [] : [target];

  const spool = spoolFor(target.color, target.textColor);
  const steps: SpoolState[] = [];
  for (let index = (from + 1) % spool.length; index !== to; index = (index + 1) % spool.length) {
    steps.push(spool[index]);
  }
  steps.push(spool[to]);
  return steps;
}

function normalizeCharacter(character: string): string {
  const normalized = character.toUpperCase();
  return glyphIndex.has(normalized) ? normalized : ' ';
}

function hashId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967295;
}

/** Each drum motor runs at a slightly different speed, so the board never ticks in lockstep. */
function stepDurationFor(id: string): number {
  return 0.068 + hashId(id) * 0.022;
}

/**
 * Hinge angle for a step at progress t in [0, 1].
 * Fall: theta = pi * s^2 (constant angular acceleration from rest, like a leaf released from its catch).
 * Rebound: two decaying bounces off the stop, |sin| shaped so the leaf never passes through it.
 */
function hingeAngle(t: number): number {
  if (t < FALL_FRACTION) {
    const s = t / FALL_FRACTION;
    return Math.PI * s * s;
  }
  const u = (t - FALL_FRACTION) / (1 - FALL_FRACTION);
  return Math.PI - REBOUND_ANGLE * Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u) ** 2;
}

function writeFace(geometry: THREE.BufferGeometry, instance: number, state: SpoolState): void {
  const bg = geometry.attributes.aBg.array as Float32Array;
  const fg = geometry.attributes.aFg.array as Float32Array;
  const glyph = geometry.attributes.aGlyph.array as Float32Array;
  const background = linearColor(state.color);
  const ink = state.character === ' ' ? background : linearColor(state.textColor);
  bg[instance * 3] = background.r;
  bg[instance * 3 + 1] = background.g;
  bg[instance * 3 + 2] = background.b;
  fg[instance * 3] = ink.r;
  fg[instance * 3 + 1] = ink.g;
  fg[instance * 3 + 2] = ink.b;
  const slot = glyphIndex.get(state.character) ?? 0;
  glyph[instance * 2] = slot % ATLAS_COLUMNS;
  glyph[instance * 2 + 1] = Math.floor(slot / ATLAS_COLUMNS);
}

const leafGeometries = [topStaticGeometry, bottomStaticGeometry, flapFrontGeometry, flapBackGeometry];

export function SplitFlapBatch({ children }: { children: ReactNode }) {
  const clock = useThree((state) => state.clock);
  const cells = useRef(new Map<string, CellDescriptor>());
  const dirty = useRef(false);
  const topStatics = useRef<THREE.InstancedMesh>(null);
  const bottomStatics = useRef<THREE.InstancedMesh>(null);
  const flapFronts = useRef<THREE.InstancedMesh>(null);
  const flapBacks = useRef<THREE.InstancedMesh>(null);
  const flapCores = useRef<THREE.InstancedMesh>(null);
  const backings = useRef<THREE.InstancedMesh>(null);
  const hinges = useRef<THREE.InstancedMesh>(null);
  const cellMatrix = useMemo(() => new THREE.Matrix4(), []);
  const hingeMatrix = useMemo(() => new THREE.Matrix4(), []);
  const rotation = useMemo(() => new THREE.Matrix4(), []);

  const register = useCallback<BatchContextValue['register']>(
    (id, input) => {
      const now = clock.elapsedTime;
      const target: SpoolState = {
        character: normalizeCharacter(input.character),
        color: input.color,
        textColor: input.textColor,
      };
      const previous = cells.current.get(id);
      if (!previous) {
        const blank: SpoolState = { character: ' ', color: input.color, textColor: input.textColor };
        cells.current.set(id, {
          current: blank,
          target,
          position: input.position,
          pending: forwardSteps(blank, target),
          nextStepAt: now + Math.max(0, input.delay),
          stepDuration: stepDurationFor(id),
          active: false,
          outgoing: blank,
          incoming: blank,
          stepStartAt: 0,
          landed: false,
        });
        dirty.current = true;
        return;
      }

      const positionChanged = previous.position.some((value, index) => value !== input.position[index]);
      previous.position = input.position;
      if (!sameState(previous.target, target)) {
        previous.target = target;
        const origin = previous.active ? previous.incoming : previous.current;
        previous.pending = forwardSteps(origin, target);
        if (!previous.active) previous.nextStepAt = now + Math.max(0, input.delay);
        dirty.current = true;
      } else if (positionChanged) {
        dirty.current = true;
      }
    },
    [clock],
  );

  const unregister = useCallback<BatchContextValue['unregister']>((id) => {
    cells.current.delete(id);
    dirty.current = true;
  }, []);

  useFrame(() => {
    if (!dirty.current) return;
    const meshes = [
      topStatics.current,
      bottomStatics.current,
      flapFronts.current,
      flapBacks.current,
      flapCores.current,
      backings.current,
      hinges.current,
    ];
    if (meshes.some((mesh) => !mesh)) return;
    const [topMesh, bottomMesh, frontMesh, backMesh, coreMesh, backingMesh, hingeMesh] =
      meshes as THREE.InstancedMesh[];

    const now = clock.elapsedTime;
    const count = cells.current.size;
    for (const mesh of meshes) mesh!.count = count;
    let index = 0;
    let hasWork = false;

    for (const cell of cells.current.values()) {
      // Advance on wall-clock time, not frame count: if frames are slow (or the tab was hidden),
      // completed steps are retired and the next leaf starts exactly when the previous one ended.
      for (let guard = 0; guard < CHARACTER_SPOOL.length + 1; guard += 1) {
        if (cell.active && now - cell.stepStartAt >= cell.stepDuration) {
          const endedAt = cell.stepStartAt + cell.stepDuration;
          if (!cell.landed) cell.landed = true;
          cell.current = cell.incoming;
          cell.active = false;
          cell.nextStepAt = endedAt;
        }
        if (!cell.active && cell.pending.length > 0 && now >= cell.nextStepAt) {
          cell.outgoing = cell.current;
          cell.incoming = cell.pending.shift()!;
          cell.stepStartAt = cell.nextStepAt;
          cell.active = true;
          cell.landed = false;
          continue;
        }
        break;
      }

      let angle = 0;
      let top = cell.current;
      let bottom = cell.current;
      let front = cell.current;
      let back = cell.current;

      if (cell.active) {
        const t = Math.min((now - cell.stepStartAt) / cell.stepDuration, 1);
        if (!cell.landed && t >= FALL_FRACTION) {
          cell.landed = true;
          playFlap(THREE.MathUtils.clamp(cell.position[0] / 8, -1, 1));
        }
        angle = hingeAngle(t);
        top = cell.incoming;
        bottom = cell.landed ? cell.incoming : cell.outgoing;
        front = cell.outgoing;
        back = cell.incoming;
      }
      hasWork ||= cell.active || cell.pending.length > 0;

      const [x, y, z] = cell.position;
      cellMatrix.makeTranslation(x, y, z);
      topMesh.setMatrixAt(index, cellMatrix);
      bottomMesh.setMatrixAt(index, cellMatrix);
      backingMesh.setMatrixAt(index, cellMatrix);
      hingeMesh.setMatrixAt(index, cellMatrix);

      hingeMatrix.makeTranslation(x, y, z + HINGE_Z).multiply(rotation.makeRotationX(angle));
      frontMesh.setMatrixAt(index, hingeMatrix);
      backMesh.setMatrixAt(index, hingeMatrix);
      coreMesh.setMatrixAt(index, hingeMatrix);

      writeFace(topStaticGeometry, index, top);
      writeFace(bottomStaticGeometry, index, bottom);
      writeFace(flapFrontGeometry, index, front);
      writeFace(flapBackGeometry, index, back);
      index += 1;
    }

    for (const geometry of leafGeometries) {
      geometry.attributes.aBg.needsUpdate = true;
      geometry.attributes.aFg.needsUpdate = true;
      geometry.attributes.aGlyph.needsUpdate = true;
    }
    for (const mesh of meshes) mesh!.instanceMatrix.needsUpdate = true;
    dirty.current = hasWork;
  });

  const context = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <BatchContext.Provider value={context}>
      {children}
      <instancedMesh ref={backings} args={[backingGeometry, backingMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={topStatics} args={[topStaticGeometry, leafMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={bottomStatics} args={[bottomStaticGeometry, leafMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={hinges} args={[hingeGeometry, hingeMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={flapCores} args={[flapCoreGeometry, flapCoreMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={flapFronts} args={[flapFrontGeometry, leafMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={flapBacks} args={[flapBackGeometry, leafMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
    </BatchContext.Provider>
  );
}

export default function SplitFlapChar({
  id,
  character,
  color = FLAP_COLOR,
  textColor = FLAP_TEXT_COLOR,
  delay = 0,
  position,
}: SplitFlapCharProps) {
  const batch = useContext(BatchContext);
  if (!batch) throw new Error('SplitFlapChar must be rendered inside SplitFlapBatch.');

  useEffect(() => () => batch.unregister(id), [batch, id]);
  useEffect(() => {
    batch.register(id, { character, color, textColor, delay, position });
  }, [batch, character, color, delay, id, position[0], position[1], position[2], textColor]);

  return null;
}

export const SPLIT_FLAP_CELL = { width: CELL_WIDTH, height: CELL_HEIGHT };
