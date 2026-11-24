import { useState } from 'react';
import { Text } from '@react-three/drei';
import SplitFlapChar from './SplitFlapChar';
import type { BoardEntry } from '../data/mockFeed';

const CELL_PITCH = 0.196;
const CELL_COUNT = 40;
const START_X = -((CELL_COUNT - 1) * CELL_PITCH) / 2;
const FLAP_COLOR = '#16171A';
const STATUS_COLORS: Record<string, { background: string; foreground: string }> = {
  'ON TRACK': { background: '#1B7A43', foreground: '#FFFFFF' },
  BOARDING: { background: '#1B7A43', foreground: '#FFFFFF' },
  'MINOR SLIP': { background: '#1B7A43', foreground: '#FFFFFF' },
  REVIEWING: { background: '#D99B00', foreground: '#111111' },
  SLIPPED: { background: '#D99B00', foreground: '#111111' },
  DELAYED: { background: '#D9531E', foreground: '#FFFFFF' },
  REROUTED: { background: '#D9531E', foreground: '#FFFFFF' },
  CANCELLED: { background: '#C81E2B', foreground: '#FFFFFF' },
  ABANDONED: { background: '#C81E2B', foreground: '#FFFFFF' },
};

interface BoardRowProps {
  entry: BoardEntry;
  index: number;
  x: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
}

export default function BoardRow({ entry, index, x, y, selected, onSelect }: BoardRowProps) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[entry.status.trim()] ?? {
    background: FLAP_COLOR,
    foreground: '#F8F9FA',
  };
  const items = [
    { key: 'code', value: entry.code, color: FLAP_COLOR, textColor: '#F8F9FA' },
    { key: 'code-destination-gap', value: ' ', color: FLAP_COLOR, textColor: '#F8F9FA' },
    { key: 'destination', value: entry.destination, color: FLAP_COLOR, textColor: '#F8F9FA' },
    { key: 'destination-gate-gap', value: ' ', color: FLAP_COLOR, textColor: '#F8F9FA' },
    { key: 'gate', value: entry.gate, color: FLAP_COLOR, textColor: '#F8F9FA' },
    { key: 'gate-status-gap', value: ' ', color: FLAP_COLOR, textColor: '#F8F9FA' },
    { key: 'status', value: entry.status, color: statusColor.background, textColor: statusColor.foreground },
  ];
  let cellIndex = 0;

  return (
    <group>
      <mesh
        position={[x, y, 0.67]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <planeGeometry args={[7.95, 0.39]} />
        <meshBasicMaterial
          color={selected ? '#D7DEE5' : '#FFFFFF'}
          transparent
          opacity={selected ? 0.12 : hovered ? 0.065 : 0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {items.map((item) =>
        Array.from(item.value).map((character, characterIndex) => {
          const currentIndex = cellIndex;
          cellIndex += 1;
          return (
            <SplitFlapChar
              key={`${item.key}-${characterIndex}`}
              id={`row-${index}-cell-${currentIndex}`}
              character={character}
              color={item.color}
              textColor={item.textColor}
              delay={index * 0.035 + currentIndex * 0.008}
              position={[x + START_X + currentIndex * CELL_PITCH, y, 0.69]}
            />
          );
        }),
      )}
    </group>
  );
}

interface ColumnHeadingProps {
  children: string;
  x: number;
  y: number;
}

export function ColumnHeading({ children, x, y }: ColumnHeadingProps) {
  return (
    <Text
      position={[x, y, 0.7]}
      fontSize={0.09}
      letterSpacing={0.035}
      color="#AAB2BB"
      anchorX="center"
      anchorY="middle"
    >
      {children}
    </Text>
  );
}

export const BOARD_COLUMN_CENTERS = [
  START_X + 2 * CELL_PITCH,
  START_X + 14.5 * CELL_PITCH,
  START_X + 26.5 * CELL_PITCH,
  START_X + 34.5 * CELL_PITCH,
];
