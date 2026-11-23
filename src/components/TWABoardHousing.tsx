import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import BoardRow, { ColumnHeading } from './BoardRow';
import { SplitFlapBatch } from './SplitFlapChar';
import type { BoardEntry } from '../data/mockFeed';

interface TWABoardHousingProps {
  entries: BoardEntry[];
}

function ArchitecturalBackdrop() {
  return (
    <group>
      <mesh position={[0, 0, -6]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#d8cbb5" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.75, -5.35]}>
        <torusGeometry args={[5.2, 0.12, 12, 96, Math.PI]} />
        <meshStandardMaterial color="#f0e8d9" roughness={0.72} />
      </mesh>
      <mesh position={[-5.2, -2.35, -5.35]} castShadow>
        <boxGeometry args={[0.24, 4.7, 0.3]} />
        <meshStandardMaterial color="#eee5d5" roughness={0.74} />
      </mesh>
      <mesh position={[5.2, -2.35, -5.35]} castShadow>
        <boxGeometry args={[0.24, 4.7, 0.3]} />
        <meshStandardMaterial color="#eee5d5" roughness={0.74} />
      </mesh>
      {[-2.65, 0, 2.65].map((x) => (
        <mesh key={x} position={[x, -1.65, -5.3]} castShadow>
          <boxGeometry args={[0.055, 4.1, 0.12]} />
          <meshStandardMaterial color="#bbae98" roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, -4.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 32]} />
        <meshStandardMaterial color="#cbbb9f" roughness={0.9} />
      </mesh>
      <mesh position={[-8, 3, -5.15]} rotation={[0, 0, -0.38]} receiveShadow>
        <planeGeometry args={[3, 10]} />
        <meshBasicMaterial color="#c3b39a" transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

function BoardFace({ entries }: TWABoardHousingProps) {
  const columnCenters = [
    -4.41,
    -3.626,
    -0.784,
    1.96,
    3.528,
  ];

  return (
    <group>
      <RoundedBox args={[10.35, 7.55, 0.58]} radius={0.38} smoothness={8} castShadow receiveShadow>
        <meshPhysicalMaterial color="#f6f4ee" roughness={0.24} metalness={0.015} clearcoat={0.42} clearcoatRoughness={0.28} />
      </RoundedBox>
      <RoundedBox position={[0, 0, 0.312]} args={[9.96, 7.13, 0.13]} radius={0.3} smoothness={8}>
        <meshStandardMaterial color="#32383b" roughness={0.74} metalness={0.12} />
      </RoundedBox>
      <Text
        position={[0, 2.99, 0.39]}
        fontSize={0.245}
        letterSpacing={0.19}
        color="#f3ede1"
        anchorX="center"
        anchorY="middle"
      >
        DEPARTS / PROMISES
      </Text>
      <Text
        position={[0, -0.64, 0.39]}
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
              <BoardRow entry={entry} index={index} y={rowY} />
            </group>
          );
        })}
      </SplitFlapBatch>
    </group>
  );
}

function Scene({ entries }: TWABoardHousingProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / size.height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const heightFit = 7.55 / (2 * Math.tan(halfFov) * 0.86);
    const widthFit = 10.35 / (2 * Math.tan(halfFov) * aspect * 0.86);
    camera.position.z = Math.max(13.5, heightFit, widthFit);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return (
    <>
      <color attach="background" args={['#d8cbb5']} />
      <fog attach="fog" args={['#d8cbb5', 17, 34]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#fff5df', '#77654f', 1.25]} />
      <directionalLight
        position={[-5, 9, 8]}
        intensity={3.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[0, 4, 9]} intensity={1.35} color="#fff4e3" />
      <pointLight position={[7, 3, 2]} intensity={40} color="#f8d7a1" distance={18} />
      <ArchitecturalBackdrop />
      <group position={[0, -0.12, 0]}>
        <BoardFace entries={entries} />
      </group>
      <ContactShadows
        position={[0, -3.93, 0.1]}
        opacity={0.34}
        scale={16}
        blur={2.2}
        far={5}
        resolution={512}
        color="#534735"
      />
    </>
  );
}

export default function TWABoardHousing({ entries }: TWABoardHousingProps) {
  return (
    <Canvas
      className="board-canvas"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 15], fov: 36, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene entries={entries} />
    </Canvas>
  );
}
