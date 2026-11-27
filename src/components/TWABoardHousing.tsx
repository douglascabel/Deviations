import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import Board, { rowPosition, type Selection } from './scene/Board';
import Shell from './scene/Shell';
import GlassWall from './scene/GlassWall';
import SideWalls from './scene/SideWalls';
import Lounges from './scene/Lounge';
import Exterior, { SUN_DIRECTION } from './scene/Exterior';
import { BOARD_Y, FLOOR_Y, validateLayout } from './scene/layout';
import type { BoardEntry } from '../data/governanceService';

export type { Selection };

interface TWABoardHousingProps {
  departures: BoardEntry[];
  arrivals: BoardEntry[];
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}

if (import.meta.env.DEV) {
  for (const problem of validateLayout()) console.error(`[layout] ${problem}`);
}

const HOME_TARGET = new THREE.Vector3(0, BOARD_Y + 0.5, 0);
/** Default view: slightly below the board, looking up into the vault, as a visitor would. */
const HOME_ELEVATION = -0.04;

function CameraRig({ selection }: { selection: Selection | null }) {
  const controls = useRef<CameraControls>(null);
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;

  useEffect(() => {
    const rig = controls.current;
    if (!rig) return;
    const aspect = size.width / Math.max(1, size.height);
    // Portrait screens get a wider lens so the camera can stay inside the hall.
    camera.fov = aspect < 1 ? 54 : 36;
    camera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    // Fit the full 18.6-unit board width (plus margin) at any aspect ratio.
    const widthFit = 23 / (2 * Math.tan(halfFov) * aspect);
    const heightFit = 14 / (2 * Math.tan(halfFov));
    const distance = Math.max(22, widthFit, heightFit);
    rig.maxDistance = Math.max(34, distance + 6);

    if (!selection) {
      void rig.setLookAt(
        0,
        HOME_TARGET.y + distance * Math.sin(HOME_ELEVATION),
        distance,
        HOME_TARGET.x,
        HOME_TARGET.y,
        HOME_TARGET.z,
        true,
      );
    } else {
      const row = rowPosition(selection);
      // On wide screens the dossier sits on the right, so frame the row left of centre.
      const shift = aspect > 1.1 ? 1.9 : 0;
      void rig.setLookAt(row.x * 0.92 + shift, row.y - 0.25, 9.2, row.x + shift, row.y, row.z, true);
    }
  }, [camera, selection, size.height, size.width]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.55}
      draggingSmoothTime={0.18}
      minDistance={6}
      maxDistance={34}
      minPolarAngle={Math.PI * 0.3}
      maxPolarAngle={Math.PI * 0.56}
      minAzimuthAngle={-0.75}
      maxAzimuthAngle={0.75}
      dollySpeed={0.6}
      truckSpeed={0}
    />
  );
}

/** Image-based lighting built from light cards, so reflections need no downloaded HDRI. */
function TerminalEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.9}>
      <color attach="background" args={['#B9C9D2']} />
      {/* Daylight through the curtain wall behind the board. */}
      <Lightformer form="rect" intensity={3.2} color="#EAF3F8" position={[0, 2, -30]} scale={[80, 20, 1]} />
      {/* Bright sky dome above. */}
      <Lightformer form="rect" intensity={1.6} color="#DDE8F2" position={[0, 30, 0]} rotation-x={Math.PI / 2} scale={[60, 60, 1]} />
      {/* Warm bounce from the carpet. */}
      <Lightformer form="rect" intensity={0.22} color="#9A4A4E" position={[0, -12, 0]} rotation-x={-Math.PI / 2} scale={[60, 60, 1]} />
      {/* Skylight seam. */}
      <Lightformer form="rect" intensity={4} color="#FFFFFF" position={[0, 14, 4]} rotation-x={Math.PI / 2} scale={[1.2, 40, 1]} />
      {/* Side glazing. */}
      <Lightformer form="rect" intensity={1.2} color="#F4EEDF" position={[-30, 4, 0]} rotation-y={Math.PI / 2} scale={[40, 14, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#F4EEDF" position={[30, 4, 0]} rotation-y={-Math.PI / 2} scale={[40, 14, 1]} />
    </Environment>
  );
}

function Lighting() {
  const sun = SUN_DIRECTION.clone().multiplyScalar(60);
  return (
    <>
      <hemisphereLight args={['#EEF3F6', '#E6DDD3', 0.85]} />
      <directionalLight
        position={[sun.x, sun.y, sun.z]}
        intensity={3.1}
        color="#FFF2DE"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={10}
        shadow-camera-far={140}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />
      {/* Soft fill on the board face from the hall. */}
      <spotLight
        position={[0, 9, 14]}
        angle={0.55}
        penumbra={1}
        intensity={140}
        distance={40}
        decay={2}
        color="#FFF4E2"
        target-position={[0, BOARD_Y, 0]}
      />
    </>
  );
}

function PostProcessing({ quality }: { quality: 'high' | 'low' }) {
  const bloom = <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.42} radius={0.7} />;
  // Low tier drops ambient occlusion; the composer needs concrete effect children, not fragments.
  return quality === 'high' ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={1.6} intensity={2.2} distanceFalloff={0.6} quality="medium" halfRes />
      {bloom}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloom}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  );
}

export default function TWABoardHousing({ departures, arrivals, selection, onSelect }: TWABoardHousingProps) {
  const [quality, setQuality] = useState<'high' | 'low'>('high');
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      className="board-canvas"
      shadows="soft"
      dpr={dpr}
      camera={{ position: [0, 3, 26], fov: 36, near: 0.5, far: 1200 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMappingExposure = 1;
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setQuality('low');
          setDpr(1);
        }}
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
      />
      <fog attach="fog" args={['#C9D6DD', 140, 900]} />
      <TerminalEnvironment />
      <Lighting />
      <Exterior />
      <Shell />
      <GlassWall />
      <SideWalls />
      <Lounges />
      <Board departures={departures} arrivals={arrivals} selection={selection} onSelect={onSelect} />
      <ContactShadows
        position={[0, FLOOR_Y + 0.012, 1]}
        opacity={0.55}
        scale={34}
        blur={2.4}
        far={3}
        resolution={1024}
        color="#3A1517"
        frames={1}
      />
      <CameraRig selection={selection} />
      <PostProcessing quality={quality} />
    </Canvas>
  );
}
