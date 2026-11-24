import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { playFlap } from '../utils/soundEngine';

const CELL_WIDTH = 0.182;
const CELL_HEIGHT = 0.37;
const HALF_HEIGHT = CELL_HEIGHT / 2;
const FLAP_DEPTH = 0.028;
const CREASE_GAP = 0.018;
const STATIC_HALF_HEIGHT = (CELL_HEIGHT - CREASE_GAP) / 2;
const MAX_CELLS = 12 * 42;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const CHARACTER_SPOOL = Array.from(' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./:');
const FLIP_THRESHOLD = 0.5;
const GLYPHS = CHARACTER_SPOOL.join('');
const FLAP_COLOR = '#16171A';
const FLAP_TEXT_COLOR = '#F8F9FA';

interface SpoolState {
  character: string;
  color: string;
  textColor: string;
}

interface CellDescriptor {
  character: string;
  color: string;
  textColor: string;
  targetCharacter: string;
  targetColor: string;
  targetTextColor: string;
  position: [number, number, number];
  pending: SpoolState[];
  nextStepAt: number;
  stepDuration: number;
  active: boolean;
  outgoingCharacter: string;
  outgoingColor: string;
  outgoingTextColor: string;
  incomingCharacter: string;
  incomingColor: string;
  incomingTextColor: string;
  stepStartAt: number;
  soundPlayed: boolean;
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

function makeAtlas(): THREE.CanvasTexture {
  const tileSize = 64;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * tileSize;
  canvas.height = ATLAS_ROWS * tileSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the split-flap character atlas.');

  context.fillStyle = '#fff';
  context.font = '700 70px "Aptos", "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 0.8;
  context.strokeStyle = '#fff';
  for (const [index, glyph] of Array.from(GLYPHS).entries()) {
    if (glyph === ' ') continue;
    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    context.save();
    context.translate((column + 0.5) * tileSize, row * tileSize);
    context.scale(1.08, 1.05);
    context.strokeText(glyph, 0, tileSize / 2);
    context.fillText(glyph, 0, tileSize / 2);
    context.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function makeGlyphGeometry(height: number, upper: boolean, flipVertical = false): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(CELL_WIDTH - 0.026, height - 0.014);
  const uv = geometry.attributes.uv;
  for (let index = 0; index < uv.count; index += 1) {
    const y = uv.getY(index);
    uv.setY(index, upper ? y * 0.5 + 0.5 : flipVertical ? (1 - y) * 0.5 : y * 0.5);
  }
  uv.needsUpdate = true;
  geometry.setAttribute(
    'instanceGlyphOffset',
    new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS * 2), 2),
  );
  geometry.setAttribute(
    'instanceGlyphScale',
    new THREE.InstancedBufferAttribute(new Float32Array(MAX_CELLS * 2), 2),
  );
  return geometry;
}

const glyphTexture = makeAtlas();
const staticGeometry = new THREE.BoxGeometry(CELL_WIDTH, STATIC_HALF_HEIGHT, FLAP_DEPTH);
const flapGeometry = new THREE.BoxGeometry(CELL_WIDTH, HALF_HEIGHT, FLAP_DEPTH);
const creaseGeometry = new THREE.BoxGeometry(CELL_WIDTH, CREASE_GAP, 0.006);
const topStaticGlyphGeometry = makeGlyphGeometry(STATIC_HALF_HEIGHT, true);
const bottomStaticGlyphGeometry = makeGlyphGeometry(STATIC_HALF_HEIGHT, false);
const movingFrontGlyphGeometry = makeGlyphGeometry(HALF_HEIGHT, true);
const movingBackGlyphGeometry = makeGlyphGeometry(HALF_HEIGHT, false);
const glyphMaterial = new THREE.MeshBasicMaterial({
  map: glyphTexture,
  transparent: true,
  toneMapped: false,
  side: THREE.DoubleSide,
});
glyphMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    '#include <common>\nattribute vec2 instanceGlyphOffset;\nattribute vec2 instanceGlyphScale;',
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    '#ifdef USE_MAP\nvMapUv = (mapTransform * vec3(uv * instanceGlyphScale + instanceGlyphOffset, 1.0)).xy;\n#endif',
  );
};
glyphMaterial.customProgramCacheKey = () => 'split-flap-atlas-v2';

const flapMaterial = new THREE.MeshStandardMaterial({
  color: '#fff',
  roughness: 0.62,
  metalness: 0.12,
});
const creaseMaterial = new THREE.MeshStandardMaterial({
  color: '#30343A',
  metalness: 0.72,
  roughness: 0.3,
});
const glyphIndex = new Map(Array.from(GLYPHS, (glyph, index) => [glyph, index]));
const topStaticY = (CREASE_GAP + STATIC_HALF_HEIGHT) / 2;
const localTopStaticOffset = new THREE.Matrix4().makeTranslation(0, topStaticY, 0);
const localBottomStaticOffset = new THREE.Matrix4().makeTranslation(0, -topStaticY, 0);
const localTopStaticGlyphOffset = new THREE.Matrix4().makeTranslation(
  0,
  topStaticY,
  FLAP_DEPTH / 2 + 0.001,
);
const localBottomStaticGlyphOffset = new THREE.Matrix4().makeTranslation(
  0,
  -topStaticY,
  FLAP_DEPTH / 2 + 0.001,
);
const localFlapCenter = new THREE.Matrix4().makeTranslation(0, HALF_HEIGHT / 2, 0.0015);
const localFrontGlyphOffset = new THREE.Matrix4().makeTranslation(
  0,
  HALF_HEIGHT / 2,
  FLAP_DEPTH / 2 + 0.0025,
);
const localBackGlyphOffset = new THREE.Matrix4()
  .makeTranslation(0, HALF_HEIGHT / 2, 0)
  .multiply(new THREE.Matrix4().makeRotationX(Math.PI))
  .multiply(new THREE.Matrix4().makeTranslation(0, 0, FLAP_DEPTH / 2 + 0.0025));
const localCreaseOffset = new THREE.Matrix4().makeTranslation(0, 0, FLAP_DEPTH / 2 + 0.003);
const instanceMatrixHelper = new THREE.Matrix4();
const instanceColor = new THREE.Color();

function spoolFor(color: string, textColor: string): SpoolState[] {
  return CHARACTER_SPOOL.map((character) => ({ character, color, textColor }));
}

function forwardSteps(current: SpoolState, target: SpoolState): SpoolState[] {
  const spool = spoolFor(target.color, target.textColor);
  const from = spool.findIndex((token) => token.character === current.character);
  const to = spool.findIndex((token) => token.character === target.character);
  if (from < 0 || to < 0) return [target];
  if (from === to) {
    return current.color === target.color && current.textColor === target.textColor ? [] : [target];
  }

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

function speedForSlot(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return 0.045 + (Math.abs(hash) % 2000) / 100000;
}

function flapAngle(progress: number): number {
  if (progress < FLIP_THRESHOLD) {
    const fallProgress = progress / FLIP_THRESHOLD;
    return -(Math.PI / 2) * fallProgress * fallProgress;
  }
  const settleProgress = (progress - FLIP_THRESHOLD) / (1 - FLIP_THRESHOLD);
  const settleEase = 1 - (1 - settleProgress) ** 2;
  return -Math.PI / 2 - (Math.PI / 2) * settleEase;
}

function writeGlyph(geometry: THREE.PlaneGeometry, instance: number, character: string): void {
  const offsets = geometry.attributes.instanceGlyphOffset as THREE.InstancedBufferAttribute;
  const scales = geometry.attributes.instanceGlyphScale as THREE.InstancedBufferAttribute;
  const slot = glyphIndex.get(character) ?? glyphIndex.get(' ')!;
  offsets.array[instance * 2] = (slot % ATLAS_COLUMNS) / ATLAS_COLUMNS;
  offsets.array[instance * 2 + 1] = 1 - (Math.floor(slot / ATLAS_COLUMNS) + 1) / ATLAS_ROWS;
  scales.array[instance * 2] = 1 / ATLAS_COLUMNS;
  scales.array[instance * 2 + 1] = 1 / ATLAS_ROWS;
}

export function SplitFlapBatch({ children }: { children: ReactNode }) {
  const clock = useThree((state) => state.clock);
  const cells = useRef(new Map<string, CellDescriptor>());
  const dirty = useRef(false);
  const topStatics = useRef<THREE.InstancedMesh>(null);
  const bottomStatics = useRef<THREE.InstancedMesh>(null);
  const flaps = useRef<THREE.InstancedMesh>(null);
  const creases = useRef<THREE.InstancedMesh>(null);
  const topStaticGlyphs = useRef<THREE.InstancedMesh>(null);
  const bottomStaticGlyphs = useRef<THREE.InstancedMesh>(null);
  const movingFrontGlyphs = useRef<THREE.InstancedMesh>(null);
  const movingBackGlyphs = useRef<THREE.InstancedMesh>(null);
  const matrixHelper = useMemo(() => new THREE.Object3D(), []);

  const register = useCallback<BatchContextValue['register']>(
    (id, input) => {
      const now = clock.elapsedTime;
      const character = normalizeCharacter(input.character);
      const previous = cells.current.get(id);
      if (!previous) {
        const initial = { character: ' ', color: input.color, textColor: input.textColor };
        const target = { character, color: input.color, textColor: input.textColor };
        cells.current.set(id, {
          character: initial.character,
          color: initial.color,
          textColor: input.textColor,
          targetCharacter: target.character,
          targetColor: target.color,
          targetTextColor: target.textColor,
          position: input.position,
          pending: forwardSteps(initial, target),
          nextStepAt: now + Math.max(0, input.delay),
          stepDuration: speedForSlot(id),
          active: false,
          outgoingCharacter: initial.character,
          outgoingColor: initial.color,
          outgoingTextColor: initial.textColor,
          incomingCharacter: initial.character,
          incomingColor: initial.color,
          incomingTextColor: initial.textColor,
          stepStartAt: 0,
          soundPlayed: false,
        });
        dirty.current = true;
        return;
      }

      const target = { character, color: input.color };
      const positionChanged = previous.position.some((coordinate, index) => coordinate !== input.position[index]);
      const targetChanged =
        previous.targetCharacter !== target.character ||
        previous.targetColor !== target.color ||
        previous.targetTextColor !== input.textColor;
      const visualChanged = previous.textColor !== input.textColor;
      previous.position = input.position;
      previous.targetCharacter = target.character;
      previous.targetColor = target.color;
      previous.targetTextColor = input.textColor;
      if (targetChanged) {
        const origin = previous.active
          ? {
              character: previous.incomingCharacter,
              color: previous.incomingColor,
              textColor: previous.incomingTextColor,
            }
          : { character: previous.character, color: previous.color, textColor: previous.textColor };
        previous.pending = forwardSteps(origin, { ...target, textColor: input.textColor });
        if (!previous.active) previous.nextStepAt = now + Math.max(0, input.delay);
        dirty.current = true;
      } else if (positionChanged || visualChanged) {
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
    const topStaticMesh = topStatics.current;
    const bottomStaticMesh = bottomStatics.current;
    const flapMesh = flaps.current;
    const creaseMesh = creases.current;
    const topStaticGlyphMesh = topStaticGlyphs.current;
    const bottomStaticGlyphMesh = bottomStaticGlyphs.current;
    const movingFrontGlyphMesh = movingFrontGlyphs.current;
    const movingBackGlyphMesh = movingBackGlyphs.current;
    if (
      !topStaticMesh || !bottomStaticMesh || !flapMesh || !creaseMesh ||
      !topStaticGlyphMesh || !bottomStaticGlyphMesh || !movingFrontGlyphMesh || !movingBackGlyphMesh
    ) return;
    const meshes = [
      topStaticMesh,
      bottomStaticMesh,
      flapMesh,
      creaseMesh,
      topStaticGlyphMesh,
      bottomStaticGlyphMesh,
      movingFrontGlyphMesh,
      movingBackGlyphMesh,
    ];
    const count = cells.current.size;
    for (const mesh of meshes) mesh.count = count;
    let index = 0;
    let hasWork = false;

    for (const cell of cells.current.values()) {
      const now = clock.elapsedTime;
      if (!cell.active && cell.pending.length > 0 && now >= cell.nextStepAt) {
        const next = cell.pending.shift()!;
        cell.outgoingCharacter = cell.character;
        cell.outgoingColor = cell.color;
        cell.outgoingTextColor = cell.textColor;
        cell.incomingCharacter = next.character;
        cell.incomingColor = next.color;
        cell.incomingTextColor = next.textColor;
        cell.stepStartAt = now;
        cell.active = true;
        cell.soundPlayed = false;
      }

      let progress = 1;
      if (cell.active) {
        progress = Math.min((now - cell.stepStartAt) / cell.stepDuration, 1);
        if (!cell.soundPlayed && progress >= FLIP_THRESHOLD) {
          playFlap();
          cell.soundPlayed = true;
        }
        if (progress >= 1) {
          cell.character = cell.incomingCharacter;
          cell.color = cell.incomingColor;
          cell.textColor = cell.incomingTextColor;
          cell.active = false;
          cell.nextStepAt = now;
        }
      }

      const active = cell.active;
      const outgoingCharacter = active ? cell.outgoingCharacter : cell.character;
      const incomingCharacter = active ? cell.incomingCharacter : cell.character;
      const outgoingColor = active ? cell.outgoingColor : cell.color;
      const incomingColor = active ? cell.incomingColor : cell.color;
      const outgoingTextColor = active ? cell.outgoingTextColor : cell.textColor;
      const incomingTextColor = active ? cell.incomingTextColor : cell.textColor;
      const midpointPassed = active && progress >= FLIP_THRESHOLD;
      const restingCharacter = midpointPassed ? incomingCharacter : outgoingCharacter;
      const restingColor = midpointPassed ? incomingColor : outgoingColor;
      const restingTextColor = midpointPassed ? incomingTextColor : outgoingTextColor;
      const angle = active ? flapAngle(progress) : -Math.PI;
      hasWork ||= active || cell.pending.length > 0 || now < cell.nextStepAt;

      matrixHelper.position.set(
        cell.position[0],
        cell.position[1],
        cell.position[2],
      );
      matrixHelper.rotation.set(0, 0, 0);
      matrixHelper.updateMatrix();
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localTopStaticOffset);
      topStaticMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localBottomStaticOffset);
      bottomStaticMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localTopStaticGlyphOffset);
      topStaticGlyphMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localBottomStaticGlyphOffset);
      bottomStaticGlyphMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localCreaseOffset);
      creaseMesh.setMatrixAt(index, instanceMatrixHelper);

      matrixHelper.rotation.x = angle;
      matrixHelper.updateMatrix();
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localFlapCenter);
      flapMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localFrontGlyphOffset);
      movingFrontGlyphMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localBackGlyphOffset);
      movingBackGlyphMesh.setMatrixAt(index, instanceMatrixHelper);

      writeGlyph(topStaticGlyphGeometry, index, restingCharacter);
      writeGlyph(bottomStaticGlyphGeometry, index, restingCharacter);
      writeGlyph(movingFrontGlyphGeometry, index, outgoingCharacter);
      writeGlyph(movingBackGlyphGeometry, index, incomingCharacter);

      instanceColor.set(restingColor);
      topStaticMesh.setColorAt(index, instanceColor);
      bottomStaticMesh.setColorAt(index, instanceColor);
      instanceColor.set(active && !midpointPassed ? outgoingColor : incomingColor);
      flapMesh.setColorAt(index, instanceColor);
      instanceColor.set(restingTextColor);
      topStaticGlyphMesh.setColorAt(index, instanceColor);
      bottomStaticGlyphMesh.setColorAt(index, instanceColor);
      instanceColor.set(outgoingTextColor);
      movingFrontGlyphMesh.setColorAt(index, instanceColor);
      instanceColor.set(incomingTextColor);
      movingBackGlyphMesh.setColorAt(index, instanceColor);
      index += 1;
    }

    for (const geometry of [
      topStaticGlyphGeometry,
      bottomStaticGlyphGeometry,
      movingFrontGlyphGeometry,
      movingBackGlyphGeometry,
    ]) {
      (geometry.attributes.instanceGlyphOffset as THREE.InstancedBufferAttribute).needsUpdate = true;
      (geometry.attributes.instanceGlyphScale as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    dirty.current = hasWork;
  });

  const context = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <BatchContext.Provider value={context}>
      {children}
      <instancedMesh ref={topStatics} args={[staticGeometry, flapMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={bottomStatics} args={[staticGeometry, flapMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={flaps} args={[flapGeometry, flapMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={creases} args={[creaseGeometry, creaseMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={topStaticGlyphs} args={[topStaticGlyphGeometry, glyphMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={bottomStaticGlyphs} args={[bottomStaticGlyphGeometry, glyphMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={movingFrontGlyphs} args={[movingFrontGlyphGeometry, glyphMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={movingBackGlyphs} args={[movingBackGlyphGeometry, glyphMaterial, MAX_CELLS]} frustumCulled={false} dispose={null} />
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
