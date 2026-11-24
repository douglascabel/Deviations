import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, Text } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import BoardRow, { BOARD_COLUMN_CENTERS, ColumnHeading } from './BoardRow';
import { SplitFlapBatch } from './SplitFlapChar';
import type { BoardEntry } from '../data/feedService';

interface TWABoardHousingProps {
  entries: BoardEntry[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const BOARD_Y = 2.12;
const BOARD_SIDE_OFFSET = 4.12;
const FIRST_ROW_Y = 1.08;
const ROW_PITCH = 0.39;
const FLOOR_Y = -5.68;

function makeCarpetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the lounge carpet texture.');

  context.fillStyle = '#A31D2B';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 14000; index += 1) {
    const x = (index * 97) % canvas.width;
    const y = (index * 193) % canvas.height;
    const lightness = 20 + ((index * 17) % 24);
    context.fillStyle = `rgba(${150 + lightness}, ${18 + Math.floor(lightness / 5)}, ${27 + Math.floor(lightness / 4)}, 0.24)`;
    context.fillRect(x, y, 2, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 12);
  texture.anisotropy = 8;
  return texture;
}

const carpetTexture = makeCarpetTexture();

function makePillGeometry(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
  const radius = height / 2;
  const straightHalf = width / 2 - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalf, -radius);
  shape.lineTo(straightHalf, -radius);
  shape.bezierCurveTo(straightHalf + radius * 0.56, -radius, width / 2, -radius * 0.56, width / 2, 0);
  shape.bezierCurveTo(width / 2, radius * 0.56, straightHalf + radius * 0.56, radius, straightHalf, radius);
  shape.lineTo(-straightHalf, radius);
  shape.bezierCurveTo(-straightHalf - radius * 0.56, radius, -width / 2, radius * 0.56, -width / 2, 0);
  shape.bezierCurveTo(-width / 2, -radius * 0.56, -straightHalf - radius * 0.56, -radius, -straightHalf, -radius);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.1,
    bevelThickness: 0.1,
    curveSegments: 20,
  });
}

const boardHousingGeometry = makePillGeometry(17.45, 5.22, 0.82);
const boardInsetGeometry = makePillGeometry(16.92, 4.78, 0.13);

const canopyShape = new THREE.Shape();
canopyShape.moveTo(-12, 5.85);
canopyShape.lineTo(12, 5.85);
canopyShape.bezierCurveTo(10.9, 7.72, 7.1, 8.82, 0, 9.18);
canopyShape.bezierCurveTo(-7.1, 8.82, -10.9, 7.72, -12, 5.85);
canopyShape.closePath();

const canopyGeometry = new THREE.ExtrudeGeometry(canopyShape, {
  depth: 18,
  bevelEnabled: true,
  bevelSegments: 6,
  bevelSize: 0.16,
  bevelThickness: 0.12,
  curveSegments: 24,
});

const airlinerShape = new THREE.Shape();
airlinerShape.moveTo(3.1, 0);
airlinerShape.lineTo(0.82, 0.13);
airlinerShape.lineTo(0.05, 0.2);
airlinerShape.lineTo(-0.58, 1.12);
airlinerShape.lineTo(-0.91, 1.12);
airlinerShape.lineTo(-0.7, 0.12);
airlinerShape.lineTo(-2.2, 0.3);
airlinerShape.lineTo(-2.85, 0.82);
airlinerShape.lineTo(-3.1, 0.82);
airlinerShape.lineTo(-2.83, 0.07);
airlinerShape.lineTo(-3.1, 0);
airlinerShape.lineTo(-2.83, -0.07);
airlinerShape.lineTo(-3.1, -0.82);
airlinerShape.lineTo(-2.85, -0.82);
airlinerShape.lineTo(-2.2, -0.3);
airlinerShape.lineTo(-0.7, -0.12);
airlinerShape.lineTo(-0.91, -1.12);
airlinerShape.lineTo(-0.58, -1.12);
airlinerShape.lineTo(0.05, -0.2);
airlinerShape.lineTo(0.82, -0.13);
airlinerShape.closePath();
const airlinerGeometry = new THREE.ShapeGeometry(airlinerShape);

function PanoramicWindows() {
  const bays = Array.from({ length: 7 }, (_, index) => {
    const x = (index - 3) * 3.65;
    return { x, z: -5.3 - (Math.abs(x) / 11) ** 2 * 0.9, yaw: -x * 0.008 };
  });

  return (
    <group>
      <mesh position={[0, 1.1, -9.5]}>
        <planeGeometry args={[48, 28]} />
        <meshBasicMaterial color="#C9DDE4" toneMapped={false} />
      </mesh>
      <mesh position={[0, -4.8, -8.95]}>
        <planeGeometry args={[52, 0.5]} />
        <meshStandardMaterial color="#B9B2A8" roughness={0.86} />
      </mesh>
      {bays.map(({ x, z, yaw }, index) => (
        <group key={index} position={[x, 1.05, z]} rotation={[0.055, yaw, 0]}>
          <mesh>
            <planeGeometry args={[3.63, 12.2]} />
            <meshPhysicalMaterial
              color="#D9E7E8"
              roughness={0.18}
              metalness={0.06}
              transparent
              opacity={0.31}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[-1.81, 0, 0.04]}>
            <boxGeometry args={[0.075, 12.35, 0.12]} />
            <meshStandardMaterial color="#4F5B5D" metalness={0.62} roughness={0.35} />
          </mesh>
          {[-6.12, -3.2, 2.9, 6.12].map((y) => (
            <mesh key={y} position={[0, y, 0.04]}>
              <boxGeometry args={[3.7, 0.075, 0.12]} />
              <meshStandardMaterial color="#4F5B5D" metalness={0.62} roughness={0.35} />
            </mesh>
          ))}
          {index === bays.length - 1 ? (
            <mesh position={[1.81, 0, 0.04]}>
              <boxGeometry args={[0.075, 12.35, 0.12]} />
              <meshStandardMaterial color="#4F5B5D" metalness={0.62} roughness={0.35} />
            </mesh>
          ) : null}
        </group>
      ))}
      <mesh geometry={airlinerGeometry} position={[1.2, -1.35, -8.55]} scale={0.68}>
        <meshBasicMaterial color="#63757A" transparent opacity={0.46} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function VaultedCanopy() {
  return (
    <mesh geometry={canopyGeometry} position={[0, 0, -8.5]} receiveShadow>
      <meshPhysicalMaterial color="#F1EFE9" roughness={0.72} metalness={0.015} side={THREE.DoubleSide} />
    </mesh>
  );
}

function LoungeIsland({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const seatAngles = Array.from({ length: 7 }, (_, index) => Math.PI * 1.08 + index * Math.PI * 0.14);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.32, 2.25, 0.36, 64]} />
        <meshPhysicalMaterial color="#811722" roughness={0.5} clearcoat={0.16} />
      </mesh>
      <mesh position={[0, 0.43, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[1.77, 0.35, 20, 96, Math.PI * 1.78]} />
        <meshPhysicalMaterial color="#C41F31" roughness={0.5} clearcoat={0.28} />
      </mesh>
      {seatAngles.map((angle) => (
        <mesh
          key={angle}
          position={[Math.sin(angle) * 1.82, 0.88, Math.cos(angle) * 1.82]}
          rotation={[0, angle, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.72, 0.66, 0.2]} />
          <meshPhysicalMaterial color="#AA1A2A" roughness={0.48} clearcoat={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function LoungeIslands() {
  return (
    <>
      <mesh position={[0, FLOOR_Y, -1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[52, 34]} />
        <meshStandardMaterial map={carpetTexture} roughness={0.96} />
      </mesh>
      <LoungeIsland position={[0, FLOOR_Y, 5.2]} rotation={0.08} />
      <LoungeIsland position={[-6.1, FLOOR_Y, 0.7]} rotation={-0.18} />
      <LoungeIsland position={[6.1, FLOOR_Y, -1.7]} rotation={0.2} />
    </>
  );
}

function SuspendedBoard({ entries, selectedIndex, onSelect }: TWABoardHousingProps) {
  return (
    <group position={[0, BOARD_Y, 0.3]}>
      <mesh geometry={boardHousingGeometry} position={[0, 0, -0.41]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#111316" roughness={0.3} metalness={0.32} clearcoat={0.4} />
      </mesh>
      <mesh geometry={boardInsetGeometry} position={[0, 0, 0.38]}>
        <meshStandardMaterial color="#111316" roughness={0.76} metalness={0.08} />
      </mesh>
      <SplitFlapBatch>
        <Text
          position={[0, 1.96, 0.7]}
          fontSize={0.265}
          letterSpacing={0.13}
          color="#F8F9FA"
          anchorX="center"
          anchorY="middle"
        >
          DEPARTURES
        </Text>
        {[-1, 1].map((direction) => {
          const sideIndex = direction < 0 ? 0 : 1;
          const sideCenter = direction * BOARD_SIDE_OFFSET;
          return (
            <group key={sideIndex}>
              {['FLIGHT', 'ORIGINATION', 'TIME', 'STATUS'].map((label, columnIndex) => (
                <ColumnHeading
                  key={label}
                  x={sideCenter + BOARD_COLUMN_CENTERS[columnIndex]}
                  y={1.52}
                >
                  {label}
                </ColumnHeading>
              ))}
              {entries.slice(sideIndex * 6, sideIndex * 6 + 6).map((entry, localIndex) => {
                const index = sideIndex * 6 + localIndex;
                return (
                  <BoardRow
                    key={`row-${index}`}
                    entry={entry}
                    index={index}
                    x={sideCenter}
                    y={FIRST_ROW_Y - localIndex * ROW_PITCH}
                    selected={selectedIndex === index}
                    onSelect={() => onSelect(index)}
                  />
                );
              })}
            </group>
          );
        })}
      </SplitFlapBatch>
      <mesh position={[0, 0, 0.57]}>
        <boxGeometry args={[0.025, 3.95, 0.025]} />
        <meshStandardMaterial color="#56616A" metalness={0.72} roughness={0.26} />
      </mesh>
    </group>
  );
}

function SuspensionCables() {
  return (
    <group>
      {[-7.25, 7.25].map((x) => (
        <group key={x}>
          <mesh position={[x, 5.11, -0.02]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.65, 8]} />
            <meshStandardMaterial color="#495256" metalness={0.82} roughness={0.24} />
          </mesh>
          <mesh position={[x * 0.72, 5.11, -0.02]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.65, 8]} />
            <meshStandardMaterial color="#495256" metalness={0.82} roughness={0.24} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Scene({ entries, selectedIndex, onSelect }: TWABoardHousingProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const homeDistance = useRef(23);
  const cameraGoal = useMemo(() => new THREE.Vector3(), []);
  const targetGoal = useMemo(() => new THREE.Vector3(), []);
  const animating = useRef(true);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / size.height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const heightFit = 13.2 / (2 * Math.tan(halfFov) * 0.86);
    const widthFit = 18.6 / (2 * Math.tan(halfFov) * aspect * 0.86);
    homeDistance.current = Math.max(22.5, heightFit, widthFit);

    if (selectedIndex === null) {
      targetGoal.set(0, 0.9, 0);
      cameraGoal.set(0, 0.9 + homeDistance.current * Math.tan(0.34), homeDistance.current);
    } else {
      const localIndex = selectedIndex % 6;
      const sideX = selectedIndex < 6 ? -BOARD_SIDE_OFFSET : BOARD_SIDE_OFFSET;
      const rowY = BOARD_Y + FIRST_ROW_Y - localIndex * ROW_PITCH;
      cameraGoal.set(sideX, rowY + 0.12, 10.2);
      targetGoal.set(sideX, rowY, 0.45);
    }
    animating.current = true;
    camera.updateProjectionMatrix();
  }, [camera, cameraGoal, selectedIndex, size.height, size.width, targetGoal]);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !controls.current) return;
    if (animating.current) {
      const interpolation = 1 - Math.exp(-delta * 2.8);
      camera.position.lerp(cameraGoal, interpolation);
      controls.current.target.lerp(targetGoal, interpolation);
      if (camera.position.distanceTo(cameraGoal) < 0.06 && controls.current.target.distanceTo(targetGoal) < 0.06) {
        camera.position.copy(cameraGoal);
        controls.current.target.copy(targetGoal);
        animating.current = false;
      }
    }
    controls.current.update();
  });

  return (
    <>
      <color attach="background" args={['#DCE6E8']} />
      <fog attach="fog" args={['#DCE6E8', 34, 58]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#F6FAFB', '#746E68', 1.05]} />
      <directionalLight
        position={[-7, 11, 8]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.00015}
      />
      <spotLight
        position={[-8, 10, 5]}
        angle={0.7}
        penumbra={0.8}
        intensity={85}
        distance={42}
        color="#FFF1D8"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <PanoramicWindows />
      <VaultedCanopy />
      <SuspensionCables />
      <SuspendedBoard entries={entries} selectedIndex={selectedIndex} onSelect={onSelect} />
      <LoungeIslands />
      <ContactShadows
        position={[0, FLOOR_Y + 0.015, 0]}
        opacity={0.36}
        scale={24}
        blur={3.2}
        far={6}
        resolution={512}
        color="#4C3532"
      />
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.075}
        minDistance={8}
        maxDistance={38}
        minPolarAngle={0.38}
        maxPolarAngle={2.45}
        makeDefault
      />
    </>
  );
}

export default function TWABoardHousing({ entries, selectedIndex, onSelect }: TWABoardHousingProps) {
  return (
    <Canvas
      className="board-canvas"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 8.95, 23], fov: 36, near: 0.1, far: 80 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene entries={entries} selectedIndex={selectedIndex} onSelect={onSelect} />
    </Canvas>
  );
}
