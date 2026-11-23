import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { playFlap } from '../utils/soundEngine';

const CELL_WIDTH = 0.182;
const CELL_HEIGHT = 0.37;
const HALF_HEIGHT = CELL_HEIGHT / 2;
const FLAP_DEPTH = 0.028;
const MAX_CELLS = 12 * 46;
const FLIP_DURATION = 0.48;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 8;
const GLYPHS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./';

interface CellDescriptor {
  character: string;
  color: string;
  delay: number;
  position: [number, number, number];
  startAt: number;
  soundPlayed: boolean;
}

interface BatchContextValue {
  register: (id: string, cell: Omit<CellDescriptor, 'startAt'>) => void;
  unregister: (id: string) => void;
}

interface SplitFlapCharProps {
  id: string;
  character: string;
  color?: string;
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
  context.font = '900 56px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 1.2;
  context.strokeStyle = '#fff';
  for (const [index, glyph] of Array.from(GLYPHS).entries()) {
    if (glyph === ' ') continue;
    const column = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    context.save();
    context.translate((column + 0.5) * tileSize, row * tileSize);
    context.scale(0.98, 0.82);
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

function makeGlyphGeometry(top: boolean): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(CELL_WIDTH - 0.026, HALF_HEIGHT - 0.014);
  const uv = geometry.attributes.uv;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setY(index, uv.getY(index) * 0.5 + (top ? 0.5 : 0));
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
const flapGeometry = new THREE.BoxGeometry(CELL_WIDTH, HALF_HEIGHT, FLAP_DEPTH);
const topGlyphGeometry = makeGlyphGeometry(true);
const bottomGlyphGeometry = makeGlyphGeometry(false);
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
glyphMaterial.customProgramCacheKey = () => 'split-flap-atlas-v1';

const flapMaterial = new THREE.MeshStandardMaterial({
  color: '#fff',
  roughness: 0.62,
  metalness: 0.12,
});
const glyphIndex = new Map(Array.from(GLYPHS, (glyph, index) => [glyph, index]));
const localTopOffset = new THREE.Matrix4().makeTranslation(0, HALF_HEIGHT / 2, 0);
const localBottomOffset = new THREE.Matrix4().makeTranslation(0, -HALF_HEIGHT / 2, 0);
const localTopGlyphOffset = new THREE.Matrix4().makeTranslation(0, HALF_HEIGHT / 2, FLAP_DEPTH / 2 + 0.001);
const localBottomGlyphOffset = new THREE.Matrix4().makeTranslation(
  0,
  -HALF_HEIGHT / 2,
  FLAP_DEPTH / 2 + 0.001,
);
const instanceMatrixHelper = new THREE.Matrix4();
const instanceColor = new THREE.Color();

export function SplitFlapBatch({ children }: { children: ReactNode }) {
  const clock = useThree((state) => state.clock);
  const cells = useRef(new Map<string, CellDescriptor>());
  const dirty = useRef(false);
  const latestAnimationEnd = useRef(0);
  const topFlaps = useRef<THREE.InstancedMesh>(null);
  const bottomFlaps = useRef<THREE.InstancedMesh>(null);
  const topGlyphs = useRef<THREE.InstancedMesh>(null);
  const bottomGlyphs = useRef<THREE.InstancedMesh>(null);
  const matrixHelper = useMemo(() => new THREE.Object3D(), []);

  const register = useCallback<BatchContextValue['register']>(
    (id, cell) => {
      const previous = cells.current.get(id);
      if (
        previous &&
        previous.character === cell.character &&
        previous.color === cell.color &&
        previous.position.every((coordinate, index) => coordinate === cell.position[index])
      ) {
        return;
      }

      cells.current.set(id, {
        ...cell,
        startAt: clock.elapsedTime + Math.max(0, cell.delay),
        soundPlayed: false,
      });
      latestAnimationEnd.current = Math.max(
        latestAnimationEnd.current,
        clock.elapsedTime + Math.max(0, cell.delay) + FLIP_DURATION,
      );
      dirty.current = true;
    },
    [clock],
  );

  const unregister = useCallback<BatchContextValue['unregister']>((id) => {
    cells.current.delete(id);
    dirty.current = true;
  }, []);

  useFrame(() => {
    if (!dirty.current && clock.elapsedTime >= latestAnimationEnd.current) return;
    const topFlapMesh = topFlaps.current;
    const bottomFlapMesh = bottomFlaps.current;
    const topGlyphMesh = topGlyphs.current;
    const bottomGlyphMesh = bottomGlyphs.current;
    if (!topFlapMesh || !bottomFlapMesh || !topGlyphMesh || !bottomGlyphMesh) return;

    const topOffsets = topGlyphGeometry.attributes.instanceGlyphOffset as THREE.InstancedBufferAttribute;
    const bottomOffsets = bottomGlyphGeometry.attributes.instanceGlyphOffset as THREE.InstancedBufferAttribute;
    const topScales = topGlyphGeometry.attributes.instanceGlyphScale as THREE.InstancedBufferAttribute;
    const bottomScales = bottomGlyphGeometry.attributes.instanceGlyphScale as THREE.InstancedBufferAttribute;
    const topOffsetArray = topOffsets.array as Float32Array;
    const bottomOffsetArray = bottomOffsets.array as Float32Array;
    const topScaleArray = topScales.array as Float32Array;
    const bottomScaleArray = bottomScales.array as Float32Array;
    const count = cells.current.size;
    topFlapMesh.count = count;
    bottomFlapMesh.count = count;
    topGlyphMesh.count = count;
    bottomGlyphMesh.count = count;
    let active = false;
    let index = 0;

    for (const cell of cells.current.values()) {
      const progress = Math.min((clock.elapsedTime - cell.startAt) / FLIP_DURATION, 1);
      if (!cell.soundPlayed && progress >= 0) {
        playFlap();
        cell.soundPlayed = true;
      }
      const normalized = Math.max(0, progress);
      active ||= progress < 1;
      const phase = normalized < 0.5 ? normalized * 2 : (1 - normalized) * 2;
      const eased = 1 - Math.pow(1 - phase, 3) + Math.sin(phase * Math.PI) * 0.035;
      const angle = (Math.PI / 2) * eased;
      const glyphSlot = glyphIndex.get(cell.character.toUpperCase()) ?? glyphIndex.get(' ')!;
      const column = glyphSlot % ATLAS_COLUMNS;
      const row = Math.floor(glyphSlot / ATLAS_COLUMNS);
      const offsetX = column / ATLAS_COLUMNS;
      const offsetY = 1 - (row + 1) / ATLAS_ROWS;
      const scaleX = 1 / ATLAS_COLUMNS;
      const scaleY = 1 / ATLAS_ROWS;

      topOffsetArray[index * 2] = offsetX;
      topOffsetArray[index * 2 + 1] = offsetY;
      bottomOffsetArray[index * 2] = offsetX;
      bottomOffsetArray[index * 2 + 1] = offsetY;
      topScaleArray[index * 2] = scaleX;
      topScaleArray[index * 2 + 1] = scaleY;
      bottomScaleArray[index * 2] = scaleX;
      bottomScaleArray[index * 2 + 1] = scaleY;
      instanceColor.set(cell.color);

      matrixHelper.position.set(...cell.position);
      matrixHelper.rotation.set(-angle, 0, 0);
      matrixHelper.updateMatrix();
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localTopOffset);
      topFlapMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localTopGlyphOffset);
      topGlyphMesh.setMatrixAt(index, instanceMatrixHelper);
      topFlapMesh.setColorAt(index, instanceColor);

      matrixHelper.rotation.x = angle;
      matrixHelper.updateMatrix();
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localBottomOffset);
      bottomFlapMesh.setMatrixAt(index, instanceMatrixHelper);
      instanceMatrixHelper.multiplyMatrices(matrixHelper.matrix, localBottomGlyphOffset);
      bottomGlyphMesh.setMatrixAt(index, instanceMatrixHelper);
      bottomFlapMesh.setColorAt(index, instanceColor);
      index += 1;
    }

    topOffsets.needsUpdate = true;
    bottomOffsets.needsUpdate = true;
    topScales.needsUpdate = true;
    bottomScales.needsUpdate = true;
    topFlapMesh.instanceMatrix.needsUpdate = true;
    bottomFlapMesh.instanceMatrix.needsUpdate = true;
    topGlyphMesh.instanceMatrix.needsUpdate = true;
    bottomGlyphMesh.instanceMatrix.needsUpdate = true;
    if (topFlapMesh.instanceColor) topFlapMesh.instanceColor.needsUpdate = true;
    if (bottomFlapMesh.instanceColor) bottomFlapMesh.instanceColor.needsUpdate = true;
    dirty.current = active;
  });

  const context = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <BatchContext.Provider value={context}>
      {children}
      <instancedMesh
        ref={topFlaps}
        args={[flapGeometry, flapMaterial, MAX_CELLS]}
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={bottomFlaps}
        args={[flapGeometry, flapMaterial, MAX_CELLS]}
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={topGlyphs}
        args={[topGlyphGeometry, glyphMaterial, MAX_CELLS]}
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={bottomGlyphs}
        args={[bottomGlyphGeometry, glyphMaterial, MAX_CELLS]}
        frustumCulled={false}
        dispose={null}
      />
    </BatchContext.Provider>
  );
}

export default function SplitFlapChar({
  id,
  character,
  color = '#292e32',
  delay = 0,
  position,
}: SplitFlapCharProps) {
  const batch = useContext(BatchContext);
  if (!batch) throw new Error('SplitFlapChar must be rendered inside SplitFlapBatch.');

  useEffect(() => {
    const cell = { character, color, delay, position };
    batch.register(id, cell);
    return () => batch.unregister(id);
  }, [batch, character, color, delay, id, position]);

  return null;
}
