import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeTarmac } from './textures';
import { FLOOR_Y } from './layout';
import Airliner, { AIRLINER_FOOTPRINT } from './Airliner';

const APRON_Y = FLOOR_Y - 0.5;

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

/** Soft contact shadow for an aircraft: fuselage and wing footprints as blurred ellipses. */
function makeShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to draw the aircraft shadow.');
  const blob = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
    context.save();
    context.translate(cx, cy);
    context.scale(rx, ry);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };
  blob(256, 256, 250, 34, 0.75); // fuselage, along x
  blob(262, 256, 70, 240, 0.55); // wings, along z
  blob(470, 256, 30, 70, 0.4); // tailplane
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const shadowTexture = makeShadowTexture();

function ParkedAirliner({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Airliner />
      <mesh position={[0.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[AIRLINER_FOOTPRINT.length * 1.05, AIRLINER_FOOTPRINT.span * 1.05]} />
        <meshBasicMaterial map={shadowTexture} transparent opacity={0.55} depthWrite={false} />
      </mesh>
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
      <ParkedAirliner position={[0, APRON_Y, -150]} rotation={0} />
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
      <mesh position={[0, APRON_Y, -240]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 480]} />
        <meshStandardMaterial map={tarmac} roughness={0.92} metalness={0} />
      </mesh>
      <ParkedAirliner position={[-34, APRON_Y, -62]} rotation={-0.95} />
      <ParkedAirliner position={[38, APRON_Y, -78]} rotation={-2.3} />
      <TaxiingAirliner />
      {/* Distant control tower and hangars, softened by haze. */}
      <group position={[0, APRON_Y, -330]}>
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
