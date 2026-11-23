import { useState } from 'react';
import { Text } from '@react-three/drei';
import SplitFlapChar from './SplitFlapChar';
import { CATEGORY_COLORS, type BoardEntry } from '../data/mockFeed';

const CELL_PITCH = 0.196;
const CELL_COUNT = 46;
const START_X = -((CELL_COUNT - 1) * CELL_PITCH) / 2;
const FLAP_COLOR = '#292e32';
const SPACER_COLOR = '#171b1f';

interface BoardRowProps {
  entry: BoardEntry;
  index: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
}

export default function BoardRow({ entry, index, y, selected, onSelect }: BoardRowProps) {
  const [hovered, setHovered] = useState(false);
  let cellIndex = 0;
  const items = [
    { key: 'category', value: ' ', color: CATEGORY_COLORS[entry.category] },
    { key: 'category-code-gap', value: ' ', color: SPACER_COLOR },
    { key: 'code', value: entry.code, color: FLAP_COLOR },
    { key: 'code-target-gap', value: ' ', color: SPACER_COLOR },
    { key: 'target', value: entry.target, color: FLAP_COLOR },
    { key: 'target-region-gap', value: ' ', color: SPACER_COLOR },
    { key: 'region', value: entry.region, color: FLAP_COLOR },
    { key: 'region-status-gap', value: ' ', color: SPACER_COLOR },
    { key: 'status', value: entry.status, color: FLAP_COLOR },
  ];

  return (
    <group>
      <mesh
        position={[0, y, 0.389]}
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
        <planeGeometry args={[9.9, 0.4]} />
        <meshBasicMaterial
          color={selected ? '#e5c28a' : '#f5ead7'}
          transparent
          opacity={selected ? 0.16 : hovered ? 0.1 : 0}
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
              delay={index * 0.055 + currentIndex * 0.012}
              position={[START_X + currentIndex * CELL_PITCH, y, 0.405]}
              categoryBlock={item.key === 'category'}
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
}

export function ColumnHeading({ children, x }: ColumnHeadingProps) {
  return (
    <Text
      position={[x, 0, 0]}
      fontSize={0.11}
      letterSpacing={0.08}
      color="#e8dfd1"
      anchorX="center"
      anchorY="middle"
    >
      {children}
    </Text>
  );
}
