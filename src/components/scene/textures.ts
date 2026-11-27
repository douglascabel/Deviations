import * as THREE from 'three';

/*
 * Procedural PBR texture sets, generated once at load. Everything here tiles seamlessly, so the
 * scene ships no binary image assets and makes no network requests for materials.
 */

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise: lattice of `period` cells that wraps at the edges. */
function makeLattice(period: number, random: () => number): Float32Array {
  const lattice = new Float32Array(period * period);
  for (let index = 0; index < lattice.length; index += 1) lattice[index] = random();
  return lattice;
}

function sampleLattice(lattice: Float32Array, period: number, u: number, v: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ix0 = ((x0 % period) + period) % period;
  const iy0 = ((y0 % period) + period) % period;
  const ix1 = (ix0 + 1) % period;
  const iy1 = (iy0 + 1) % period;
  const a = lattice[iy0 * period + ix0];
  const b = lattice[iy0 * period + ix1];
  const c = lattice[iy1 * period + ix0];
  const d = lattice[iy1 * period + ix1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise field in [0, 1], `size` x `size`, tileable. */
function fbmField(size: number, basePeriod: number, octaves: number, seed: number, gain = 0.5): Float32Array {
  const random = seeded(seed);
  const layers = Array.from({ length: octaves }, (_, octave) => {
    const period = basePeriod * 2 ** octave;
    return { period, lattice: makeLattice(period, random), amplitude: gain ** octave };
  });
  const total = layers.reduce((sum, layer) => sum + layer.amplitude, 0);
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0;
      for (const layer of layers) {
        value += sampleLattice(layer.lattice, layer.period, x / size, y / size) * layer.amplitude;
      }
      field[y * size + x] = value / total;
    }
  }
  return field;
}

function toTexture(data: Uint8Array<ArrayBuffer>, size: number, srgb: boolean, repeat: [number, number]): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Tangent-space normal map from a height field (central differences, wrapping). */
function normalMap(height: Float32Array, size: number, strength: number, repeat: [number, number]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = height[y * size + ((x - 1 + size) % size)];
      const right = height[y * size + ((x + 1) % size)];
      const down = height[((y - 1 + size) % size) * size + x];
      const up = height[((y + 1) % size) * size + x];
      const nx = (left - right) * strength;
      const ny = (down - up) * strength;
      const length = Math.hypot(nx, ny, 1);
      const offset = (y * size + x) * 4;
      data[offset] = ((nx / length) * 0.5 + 0.5) * 255;
      data[offset + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      data[offset + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      data[offset + 3] = 255;
    }
  }
  return toTexture(data, size, false, repeat);
}

function grayMap(values: Float32Array, size: number, repeat: [number, number]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < values.length; index += 1) {
    const value = Math.max(0, Math.min(255, values[index] * 255));
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  }
  return toTexture(data, size, false, repeat);
}

function colorMap(
  values: Float32Array,
  size: number,
  dark: [number, number, number],
  light: [number, number, number],
  repeat: [number, number],
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < values.length; index += 1) {
    const t = values[index];
    data[index * 4] = dark[0] + (light[0] - dark[0]) * t;
    data[index * 4 + 1] = dark[1] + (light[1] - dark[1]) * t;
    data[index * 4 + 2] = dark[2] + (light[2] - dark[2]) * t;
    data[index * 4 + 3] = 255;
  }
  return toTexture(data, size, true, repeat);
}

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/** Smooth-trowelled white concrete / plaster: broad mottling, fine pitting, faint form seams. */
export function makeConcrete(repeat: [number, number] = [6, 6]): PbrSet {
  const size = 512;
  const broad = fbmField(size, 4, 4, 11, 0.55);
  const grain = fbmField(size, 64, 3, 23, 0.5);
  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let index = 0; index < height.length; index += 1) {
    const pit = grain[index] > 0.74 ? (grain[index] - 0.74) * 2.4 : 0;
    height[index] = broad[index] * 0.35 + grain[index] * 0.5 - pit;
    tone[index] = 0.72 + broad[index] * 0.24 - pit * 0.4;
    rough[index] = 0.74 + grain[index] * 0.16 + pit * 0.2;
  }
  return {
    map: colorMap(tone, size, [200, 196, 188], [246, 243, 236], repeat),
    normalMap: normalMap(height, size, 1.6, repeat),
    roughnessMap: grayMap(rough, size, repeat),
  };
}

/** Dense cut-pile crimson carpet: tufted fibre noise with a faint tonal cloud. */
export function makeCarpet(repeat: [number, number]): PbrSet {
  const size = 512;
  const fibre = fbmField(size, 128, 2, 37, 0.6);
  const tuft = fbmField(size, 64, 2, 41, 0.5);
  const cloud = fbmField(size, 4, 3, 53, 0.5);
  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let index = 0; index < height.length; index += 1) {
    height[index] = fibre[index] * 0.6 + tuft[index] * 0.4;
    tone[index] = 0.25 + fibre[index] * 0.45 + cloud[index] * 0.3;
    rough[index] = 0.88 + fibre[index] * 0.12;
  }
  return {
    map: colorMap(tone, size, [74, 8, 16], [150, 22, 34], repeat),
    normalMap: normalMap(height, size, 4.2, repeat),
    roughnessMap: grayMap(rough, size, repeat),
  };
}

/** Wool-blend upholstery: a tight basket weave with slubs. */
export function makeUpholstery(repeat: [number, number]): Omit<PbrSet, 'map'> {
  const size = 256;
  const slub = fbmField(size, 32, 2, 71, 0.5);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const threads = 64;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * threads * Math.PI * 2;
      const v = (y / size) * threads * Math.PI * 2;
      const over = Math.sin(u) * Math.sin(v * 0.5) > 0 ? Math.abs(Math.sin(v)) : Math.abs(Math.sin(u));
      const index = y * size + x;
      height[index] = over * 0.7 + slub[index] * 0.3;
      rough[index] = 0.7 + over * 0.15;
    }
  }
  return {
    normalMap: normalMap(height, size, 2.2, repeat),
    roughnessMap: grayMap(rough, size, repeat),
  };
}

/** Weathered apron concrete with expansion joints and painted taxi guidance. */
export function makeTarmac(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the apron texture.');
  context.fillStyle = '#8F918E';
  context.fillRect(0, 0, 1024, 1024);
  const random = seeded(97);
  for (let index = 0; index < 22000; index += 1) {
    const shade = 120 + random() * 50;
    context.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade}, 0.18)`;
    context.fillRect(random() * 1024, random() * 1024, 1 + random() * 3, 1 + random() * 3);
  }
  context.strokeStyle = 'rgba(70, 72, 70, 0.55)';
  context.lineWidth = 2;
  for (let line = 0; line <= 1024; line += 128) {
    context.beginPath();
    context.moveTo(line, 0);
    context.lineTo(line, 1024);
    context.moveTo(0, line);
    context.lineTo(1024, line);
    context.stroke();
  }
  context.strokeStyle = 'rgba(232, 182, 52, 0.85)';
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(512, 0);
  context.lineTo(512, 1024);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Cut-pile carpet as a fabric, not a hard floor: no mirror-like specular (fibres scatter light),
 * a faint, rough sheen that only rises at grazing angles, and low environment reflection.
 */
export function makeCarpetMaterial(set: PbrSet, normalStrength = 0.7): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map: set.map,
    normalMap: set.normalMap,
    normalScale: new THREE.Vector2(normalStrength, normalStrength),
    roughnessMap: set.roughnessMap,
    roughness: 1,
    metalness: 0,
    specularIntensity: 0.08,
    sheen: 0.55,
    sheenColor: new THREE.Color('#7A1621'),
    sheenRoughness: 0.9,
    envMapIntensity: 0.3,
  });
}
