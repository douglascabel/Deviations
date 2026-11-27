import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeTarmac } from './textures';
import { FLOOR_Y } from './layout';

export const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.42, -0.79).normalize();

/** Gradient sky with horizon haze and a soft sun glow. Unfogged, unlit. */
function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSun: { value: SUN_DIRECTION },
          uZenith: { value: new THREE.Color('#3B74B2') },
          uHorizon: { value: new THREE.Color('#C6D8E3') },
          uGround: { value: new THREE.Color('#B9BDB8') },
        },
        vertexShader: `
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 uSun;
          uniform vec3 uZenith;
          uniform vec3 uHorizon;
          uniform vec3 uGround;
          varying vec3 vDirection;
          void main() {
            vec3 d = normalize(vDirection);
            float h = d.y;
            vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
            sky = mix(sky, uGround, smoothstep(0.0, -0.08, h));
            float sun = max(dot(d, uSun), 0.0);
            sky += vec3(1.0, 0.93, 0.8) * (pow(sun, 900.0) * 8.0 + pow(sun, 12.0) * 0.35);
            // Faint banded cirrus.
            float band = smoothstep(0.05, 0.35, h) * (1.0 - smoothstep(0.35, 0.8, h));
            sky = mix(sky, vec3(0.96), band * 0.18 * (0.5 + 0.5 * sin(d.x * 9.0 + d.z * 5.0)));
            gl_FragColor = vec4(sky, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[480, 48, 24]} />
    </mesh>
  );
}

const fuselage = new THREE.CylinderGeometry(1.9, 1.9, 36, 24, 1).rotateZ(Math.PI / 2);
const nose = new THREE.SphereGeometry(1.9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).scale(2.4, 1, 1);
const tailCone = new THREE.ConeGeometry(1.9, 7, 24).rotateZ(Math.PI / 2);
const cheatline = new THREE.CylinderGeometry(1.93, 1.93, 40, 24, 1, true, Math.PI * 0.32, Math.PI * 0.36).rotateZ(Math.PI / 2);

function sweptPlanform(span: number, root: number, tip: number, sweep: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(sweep, span);
  shape.lineTo(sweep + tip, span);
  shape.lineTo(root, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: false });
}

const wing = sweptPlanform(19, 8, 2.2, 9);
const stabiliser = sweptPlanform(7, 4, 1.4, 4);
const fin = sweptPlanform(8, 6, 1.8, 6);
const enginePod = new THREE.CylinderGeometry(0.75, 0.62, 4.4, 16).rotateZ(Math.PI / 2);

/** A four-engine jet of the era, in a white livery with a red cheatline. */
function Airliner({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const engines = [-7, -12.5, 7, 12.5];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={fuselage} castShadow>
        <meshStandardMaterial color="#F2F2EE" metalness={0.25} roughness={0.35} />
      </mesh>
      <mesh geometry={cheatline}>
        <meshStandardMaterial color="#B3202E" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={nose} position={[-18, 0, 0]}>
        <meshStandardMaterial color="#F2F2EE" metalness={0.25} roughness={0.35} />
      </mesh>
      <mesh geometry={tailCone} position={[21.5, 0.35, 0]} scale={[1, 1, 1]}>
        <meshStandardMaterial color="#F2F2EE" metalness={0.25} roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh geometry={wing} position={[-4, -0.6, 0]} rotation={[side * Math.PI / 2, 0, 0]} scale={[1, side, 1]}>
            <meshStandardMaterial color="#D9DBDA" metalness={0.5} roughness={0.32} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={stabiliser} position={[16, 0.8, 0]} rotation={[side * Math.PI / 2, 0, 0]} scale={[1, side, 1]}>
            <meshStandardMaterial color="#D9DBDA" metalness={0.5} roughness={0.32} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh geometry={fin} position={[14, 1.6, -0.16]}>
        <meshStandardMaterial color="#B3202E" roughness={0.45} />
      </mesh>
      {engines.map((z) => (
        <mesh key={z} geometry={enginePod} position={[-1 + Math.abs(z) * 0.42, -1.8, z]} castShadow>
          <meshStandardMaterial color="#C9CCCB" metalness={0.65} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function TaxiingAirliner() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    // A slow loop along the taxiway, 160 s per pass.
    const t = (clock.elapsedTime / 160) % 1;
    group.current.position.x = 260 - t * 520;
  });
  return (
    <group ref={group} position={[0, 0, 0]}>
      <Airliner position={[0, FLOOR_Y + 2.4, -150]} rotation={0} />
    </group>
  );
}

export default function Exterior() {
  const tarmac = useMemo(() => {
    const texture = makeTarmac();
    texture.repeat.set(24, 24);
    return texture;
  }, []);

  return (
    <group>
      <Sky />
      <mesh position={[0, FLOOR_Y - 0.5, -240]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 480]} />
        <meshStandardMaterial map={tarmac} roughness={0.92} metalness={0} />
      </mesh>
      <Airliner position={[-34, FLOOR_Y + 2.4, -62]} rotation={-0.95} />
      <Airliner position={[38, FLOOR_Y + 2.4, -78]} rotation={-2.3} />
      <TaxiingAirliner />
      {/* Distant control tower and hangars, softened by haze. */}
      <group position={[0, FLOOR_Y - 0.5, -330]}>
        <mesh position={[-120, 18, 0]}>
          <cylinderGeometry args={[3, 4, 36, 16]} />
          <meshStandardMaterial color="#C3C8C8" roughness={0.8} />
        </mesh>
        <mesh position={[-120, 38, 0]}>
          <cylinderGeometry args={[7, 5, 6, 16]} />
          <meshStandardMaterial color="#6B7F86" roughness={0.3} metalness={0.4} />
        </mesh>
        {[-40, 30, 95].map((x, index) => (
          <mesh key={x} position={[x, 9, -20 - index * 12]}>
            <boxGeometry args={[60, 18, 40]} />
            <meshStandardMaterial color="#BFC3BF" roughness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
