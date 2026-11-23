import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import BoardRow, { ColumnHeading } from './BoardRow';
import { SplitFlapBatch } from './SplitFlapChar';
import type { BoardEntry } from '../data/mockFeed';

interface TWABoardHousingProps {
  entries: BoardEntry[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const shellShape = new THREE.Shape();
shellShape.moveTo(-5.3, -4.18);
shellShape.bezierCurveTo(-6.55, -4.55, -7.05, -3.86, -6.45, -2.96);
shellShape.bezierCurveTo(-5.98, -2.24, -5.75, -1.32, -5.98, -0.5);
shellShape.bezierCurveTo(-6.5, 1.36, -7.04, 3.64, -6.2, 4.24);
shellShape.bezierCurveTo(-5.65, 4.62, -5.12, 4.12, -4.62, 3.74);
shellShape.bezierCurveTo(-2.46, 2.08, 2.46, 2.08, 4.62, 3.74);
shellShape.bezierCurveTo(5.12, 4.12, 5.65, 4.62, 6.2, 4.24);
shellShape.bezierCurveTo(7.04, 3.64, 6.5, 1.36, 5.98, -0.5);
shellShape.bezierCurveTo(5.75, -1.32, 5.98, -2.24, 6.45, -2.96);
shellShape.bezierCurveTo(7.05, -3.86, 6.55, -4.55, 5.3, -4.18);
shellShape.bezierCurveTo(3.12, -3.42, -3.12, -3.42, -5.3, -4.18);
shellShape.closePath();

const shellGeometry = new THREE.ExtrudeGeometry(shellShape, {
  depth: 0.54,
  bevelEnabled: true,
  bevelSegments: 8,
  steps: 1,
  bevelSize: 0.13,
  bevelThickness: 0.14,
  curveSegments: 18,
});
const lowerTrimCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-5.45, -4.05, -0.02),
  new THREE.Vector3(-3.9, -4.02, -0.02),
  new THREE.Vector3(-1.9, -3.96, -0.02),
  new THREE.Vector3(0, -3.94, -0.02),
  new THREE.Vector3(1.9, -3.96, -0.02),
  new THREE.Vector3(3.9, -4.02, -0.02),
  new THREE.Vector3(5.45, -4.05, -0.02),
]);

function ArchitecturalBackdrop() {
  return (
    <group>
      <mesh position={[0, 0, -6]} receiveShadow>
        <planeGeometry args={[42, 30]} />
        <meshStandardMaterial color="#eee8dd" roughness={0.96} />
      </mesh>
      <mesh position={[0, -5.72, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 36]} />
        <meshStandardMaterial color="#d5c9b6" roughness={0.92} />
      </mesh>
      <mesh position={[0, -5.69, 2.15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.7, 9.5]} />
        <meshStandardMaterial color="#8f2638" roughness={0.94} />
      </mesh>
      <mesh position={[0, -5.675, -1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.76, 0.055]} />
        <meshBasicMaterial color="#d7b875" toneMapped={false} />
      </mesh>
    </group>
  );
}

function SculpturalShell() {
  return (
    <group position={[0, -0.12, -0.72]}>
      <mesh geometry={shellGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#f4f0e5"
          roughness={0.28}
          metalness={0.015}
          clearcoat={0.55}
          clearcoatRoughness={0.24}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[lowerTrimCurve, 96, 0.038, 8, false]} />
        <meshStandardMaterial color="#9b2638" roughness={0.38} metalness={0.08} />
      </mesh>
      {[-2.65, 2.65].map((x) => (
        <RoundedBox
          key={x}
          position={[x, -4.73, 0.22]}
          rotation={[0, 0, x < 0 ? -0.045 : 0.045]}
          args={[0.48, 1.05, 0.62]}
          radius={0.14}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial color="#eee9de" roughness={0.3} clearcoat={0.3} />
        </RoundedBox>
      ))}
      <RoundedBox
        position={[0, -5.3, 0.14]}
        args={[4.8, 0.34, 1.18]}
        radius={0.13}
        smoothness={6}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color="#eae4d7" roughness={0.3} metalness={0.025} clearcoat={0.38} />
      </RoundedBox>
      <mesh position={[0, -5.13, 0.75]} castShadow>
        <boxGeometry args={[4.2, 0.045, 0.035]} />
        <meshStandardMaterial color="#a3293a" metalness={0.12} roughness={0.34} />
      </mesh>
    </group>
  );
}

function BoardFace({ entries, selectedIndex, onSelect }: TWABoardHousingProps) {
  const columnCenters = [-4.41, -3.626, -0.784, 1.96, 3.528];

  return (
    <group>
      <RoundedBox
        args={[10.42, 7.62, 0.48]}
        radius={0.28}
        smoothness={8}
        position={[0, 0, 0.02]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color="#303538" roughness={0.44} metalness={0.18} clearcoat={0.36} />
      </RoundedBox>
      <RoundedBox position={[0, 0, 0.28]} args={[9.96, 7.13, 0.13]} radius={0.22} smoothness={8}>
        <meshStandardMaterial color="#32383b" roughness={0.74} metalness={0.12} />
      </RoundedBox>
      <Text
        position={[0, 2.99, 0.36]}
        fontSize={0.245}
        letterSpacing={0.19}
        color="#f3ede1"
        anchorX="center"
        anchorY="middle"
      >
        DEPARTS / PROMISES
      </Text>
      <Text
        position={[0, -0.64, 0.36]}
        fontSize={0.245}
        letterSpacing={0.19}
        color="#f3ede1"
        anchorX="center"
        anchorY="middle"
      >
        ARRIVES / REALITY
      </Text>
      <SplitFlapBatch>
        {entries.map((entry, index) => {
          const rowY = index < 6 ? 2.55 - index * 0.42 : -1.18 - (index - 6) * 0.42;
          const headingY = index < 6 ? 2.82 : -0.91;
          return (
            <group key={`row-${index}`}>
              {index === 0 || index === 6 ? (
                <group position={[0, headingY, 0.405]}>
                  {['CAT', 'CODE', 'COMMITMENT', 'REGION', 'STATUS'].map((label, columnIndex) => (
                    <ColumnHeading key={label} x={columnCenters[columnIndex]}>
                      {label}
                    </ColumnHeading>
                  ))}
                </group>
              ) : null}
              <BoardRow
                entry={entry}
                index={index}
                y={rowY}
                selected={selectedIndex === index}
                onSelect={() => onSelect(index)}
              />
            </group>
          );
        })}
      </SplitFlapBatch>
    </group>
  );
}

function Scene({ entries, selectedIndex, onSelect }: TWABoardHousingProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const homeDistance = useRef(17);
  const cameraGoal = useMemo(() => new THREE.Vector3(), []);
  const targetGoal = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / size.height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const heightFit = 10.95 / (2 * Math.tan(halfFov) * 0.86);
    const widthFit = 13.9 / (2 * Math.tan(halfFov) * aspect * 0.86);
    homeDistance.current = Math.max(17, heightFit, widthFit);
    if (selectedIndex === null) camera.position.set(0, -0.45, homeDistance.current);
    camera.updateProjectionMatrix();
  }, [camera, selectedIndex, size.height, size.width]);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !controls.current) return;
    if (selectedIndex === null) {
      cameraGoal.set(0, -0.45, homeDistance.current);
      targetGoal.set(0, -0.45, 0);
    } else {
      const rowY = selectedIndex < 6 ? 2.55 - selectedIndex * 0.42 : -1.18 - (selectedIndex - 6) * 0.42;
      cameraGoal.set(0, rowY + 0.48, 9.2);
      targetGoal.set(0, rowY, 0);
    }

    const interpolation = 1 - Math.exp(-delta * 3.6);
    camera.position.lerp(cameraGoal, interpolation);
    controls.current.target.lerp(targetGoal, interpolation);
    controls.current.update();
  });

  return (
    <>
      <color attach="background" args={['#eee8dd']} />
      <fog attach="fog" args={['#eee8dd', 22, 42]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#fff8e9', '#74654f', 0.9]} />
      <directionalLight
        position={[-5, 9, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.00015}
      />
      <spotLight
        position={[-5.5, 9, 7]}
        angle={0.68}
        penumbra={0.72}
        intensity={95}
        distance={32}
        color="#ffe7bd"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight
        position={[5, 7, 3]}
        angle={0.7}
        penumbra={0.8}
        intensity={58}
        distance={28}
        color="#fff4dd"
      />
      <ArchitecturalBackdrop />
      <SculpturalShell />
      <group position={[0, -0.12, 0]}>
        <BoardFace entries={entries} selectedIndex={selectedIndex} onSelect={onSelect} />
      </group>
      <ContactShadows
        position={[0, -5.68, 0.1]}
        opacity={0.34}
        scale={16}
        blur={2.2}
        far={5}
        resolution={512}
        color="#534735"
      />
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableRotate={false}
        enableZoom={false}
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
      camera={{ position: [0, -0.45, 17], fov: 36, near: 0.1, far: 70 }}
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
