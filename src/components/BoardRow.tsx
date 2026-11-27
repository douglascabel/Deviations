import { useState } from 'react';
import { Text } from '@react-three/drei';
import headingFont from '@fontsource/jost/files/jost-latin-600-normal.woff?url';
import titleFont from '@fontsource/jost/files/jost-latin-500-normal.woff?url';
import SplitFlapChar from './SplitFlapChar';
import { COLUMN_WIDTHS, STATUS_COLORS, type BoardEntry } from '../data/governanceService';

export const CELL_PITCH = 0.196;
export const CELL_COUNT = 41;
export const BOARD_WIDTH = CELL_COUNT * CELL_PITCH;
const START_X = -((CELL_COUNT - 1) * CELL_PITCH) / 2;
const FLAP_COLOR = '#16171A';
const FLAP_TEXT = '#F3F1EA';
const CELL_Z = 0.69;

/** Columns in cell units: code | gap | initiative | gap | target | gap | status. */
const COLUMNS = (() => {
  const code = 0;
  const initiative = code + COLUMN_WIDTHS.code + 2;
  const target = initiative + COLUMN_WIDTHS.initiative + 1;
  const status = target + COLUMN_WIDTHS.target + 1;
  return { code, initiative, target, status };
})();

export const COLUMN_HEADINGS: { label: string; startCell: number }[] = [
  { label: 'BODY / TREATY', startCell: COLUMNS.code },
  { label: 'INITIATIVE', startCell: COLUMNS.initiative },
  { label: 'TARGET', startCell: COLUMNS.target },
  { label: 'STATUS', startCell: COLUMNS.status },
];

interface BoardRowProps {
  entry: BoardEntry;
  /** Globally unique row id, used to key flap cells. */
  rowKey: string;
  /** Order on screen (0..11), used for cascade timing. */
  order: number;
  x: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
}

export default function BoardRow({ entry, rowKey, order, x, y, selected, onSelect }: BoardRowProps) {
  const [hovered, setHovered] = useState(false);
  const status = STATUS_COLORS[entry.status.trim()] ?? { background: FLAP_COLOR, foreground: FLAP_TEXT };
  const segments = [
    { start: COLUMNS.code, value: entry.code, color: FLAP_COLOR, text: FLAP_TEXT },
    { start: COLUMNS.initiative, value: entry.initiative, color: FLAP_COLOR, text: FLAP_TEXT },
    { start: COLUMNS.target, value: entry.target, color: FLAP_COLOR, text: '#F2C14E' },
    { start: COLUMNS.status, value: entry.status, color: status.background, text: status.foreground },
  ];
  const cells: { cell: number; character: string; color: string; text: string }[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    cells.push({ cell, character: ' ', color: FLAP_COLOR, text: FLAP_TEXT });
  }
  for (const segment of segments) {
    Array.from(segment.value).forEach((character, offset) => {
      cells[segment.start + offset] = {
        cell: segment.start + offset,
        character,
        color: segment.color,
        text: segment.text,
      };
    });
  }

  return (
    <group>
      <mesh
        position={[x, y, CELL_Z + 0.06]}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (!entry.item) return;
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (entry.item) onSelect();
        }}
      >
        <planeGeometry args={[BOARD_WIDTH + 0.06, 0.4]} />
        <meshBasicMaterial
          color="#FFF6DE"
          transparent
          opacity={selected ? 0.1 : hovered ? 0.055 : 0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {cells.map(({ cell, character, color, text }) => (
        <SplitFlapChar
          key={cell}
          id={`${rowKey}-cell-${cell}`}
          character={character}
          color={color}
          textColor={text}
          // Cascade: rows ripple downward, cells sweep left to right like a Solari drum bank.
          delay={order * 0.07 + cell * 0.012}
          position={[x + START_X + cell * CELL_PITCH, y, CELL_Z]}
        />
      ))}
    </group>
  );
}

interface HeadingProps {
  x: number;
  y: number;
}

/** Column headings, left-aligned to the first flap of each column. */
export function ColumnHeadings({ x, y }: HeadingProps) {
  return (
    <group>
      {COLUMN_HEADINGS.map(({ label, startCell }) => (
        <Text
          key={label}
          font={headingFont}
          position={[x + START_X + startCell * CELL_PITCH - CELL_PITCH * 0.42, y, CELL_Z + 0.01]}
          fontSize={0.155}
          letterSpacing={0.03}
          color="#EFE3C4"
          anchorX="left"
          anchorY="middle"
        >
          {label}
        </Text>
      ))}
      <mesh position={[x, y - 0.15, CELL_Z - 0.005]}>
        <planeGeometry args={[BOARD_WIDTH, 0.014]} />
        <meshStandardMaterial color="#B8944A" metalness={0.9} roughness={0.28} />
      </mesh>
    </group>
  );
}

interface BoardTitleProps {
  x: number;
  y: number;
  children: string;
  subtitle: string;
}

export function BoardTitle({ x, y, children, subtitle }: BoardTitleProps) {
  return (
    <group position={[x, y, CELL_Z + 0.01]}>
      <Text
        font={titleFont}
        fontSize={0.33}
        letterSpacing={0.28}
        color="#F8F4EA"
        anchorX="center"
        anchorY="middle"
      >
        {children}
      </Text>
      <Text
        font={headingFont}
        position={[0, -0.29, 0]}
        fontSize={0.105}
        letterSpacing={0.24}
        color="#9C9480"
        anchorX="center"
        anchorY="middle"
      >
        {subtitle}
      </Text>
    </group>
  );
}
