import * as THREE from 'three';
import BoardRow, { BOARD_WIDTH, BoardTitle, ColumnHeadings } from '../BoardRow';
import { SplitFlapBatch } from '../SplitFlapChar';
import type { Board as BoardName, BoardEntry } from '../../data/governanceService';
import {
  BOARD_HEADINGS_Y,
  BOARD_SIDE_OFFSET,
  BOARD_TITLE_Y,
  BOARD_Y,
  BOARD_Z,
  FIRST_ROW_Y,
  ROW_PITCH,
  shellY,
} from './layout';

export interface Selection {
  board: BoardName;
  row: number;
}

interface BoardProps {
  departures: BoardEntry[];
  arrivals: BoardEntry[];
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}

const HOUSING_WIDTH = 18.3;
const HOUSING_HEIGHT = 5.22;

function makePillGeometry(width: number, height: number, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const radius = height / 2;
  const straight = width / 2 - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-straight, -radius);
  shape.lineTo(straight, -radius);
  shape.absarc(straight, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-straight, radius);
  shape.absarc(-straight, 0, radius, Math.PI / 2, (Math.PI * 3) / 2, false);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 48,
  });
}

const housingGeometry = makePillGeometry(HOUSING_WIDTH, HOUSING_HEIGHT, 0.82, 0.12);
const faceGeometry = makePillGeometry(HOUSING_WIDTH - 0.5, HOUSING_HEIGHT - 0.42, 0.06, 0.03);
const trimGeometry = (() => {
  const geometry = makePillGeometry(HOUSING_WIDTH + 0.04, HOUSING_HEIGHT + 0.04, 0.05, 0.025);
  return geometry;
})();

export const BOARD_SIDES: { board: BoardName; title: string; subtitle: string; direction: -1 | 1 }[] = [
  { board: 'departures', title: 'DEPARTURES', subtitle: 'NEWLY AGREED GLOBAL COMMITMENTS', direction: -1 },
  { board: 'arrivals', title: 'ARRIVALS', subtitle: 'COMMITMENTS PAST THEIR TARGET DATE', direction: 1 },
];

export function rowPosition(selection: Selection): THREE.Vector3 {
  const side = BOARD_SIDES.find(({ board }) => board === selection.board)!;
  return new THREE.Vector3(
    side.direction * BOARD_SIDE_OFFSET,
    BOARD_Y + FIRST_ROW_Y - selection.row * ROW_PITCH,
    BOARD_Z + 0.7,
  );
}

function Cables() {
  const top = BOARD_Y + HOUSING_HEIGHT / 2;
  return (
    <group>
      {[-6.2, -2.4, 2.4, 6.2].map((x) => {
        const anchor = shellY(x, BOARD_Z - 0.1);
        const length = anchor - top;
        return (
          <group key={x}>
            <mesh position={[x, top + length / 2, BOARD_Z - 0.1]} castShadow>
              <cylinderGeometry args={[0.032, 0.032, length, 10]} />
              <meshStandardMaterial color="#4A5257" metalness={0.9} roughness={0.22} />
            </mesh>
            <mesh position={[x, anchor - 0.06, BOARD_Z - 0.1]}>
              <cylinderGeometry args={[0.12, 0.08, 0.12, 16]} />
              <meshStandardMaterial color="#D8D4CB" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function Board({ departures, arrivals, selection, onSelect }: BoardProps) {
  const rows = { departures, arrivals };
  return (
    <group>
      <Cables />
      <group position={[0, BOARD_Y, BOARD_Z]}>
        <mesh geometry={housingGeometry} position={[0, 0, -0.41]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#0E1013"
            roughness={0.26}
            metalness={0.35}
            clearcoat={1}
            clearcoatRoughness={0.12}
            envMapIntensity={1.3}
          />
        </mesh>
        <mesh geometry={trimGeometry} position={[0, 0, 0.18]}>
          <meshStandardMaterial color="#9C8045" metalness={0.92} roughness={0.25} />
        </mesh>
        <mesh geometry={faceGeometry} position={[0, 0, 0.5]} receiveShadow>
          <meshStandardMaterial color="#0A0B0D" roughness={0.82} metalness={0.08} />
        </mesh>
        {/* Centre divider between the two boards. */}
        <mesh position={[0, -0.12, 0.66]}>
          <boxGeometry args={[0.028, 4.2, 0.02]} />
          <meshStandardMaterial color="#9C8045" metalness={0.92} roughness={0.25} />
        </mesh>
        <SplitFlapBatch>
          {BOARD_SIDES.map(({ board, title, subtitle, direction }) => {
            const x = direction * BOARD_SIDE_OFFSET;
            return (
              <group key={board}>
                <BoardTitle x={x} y={BOARD_TITLE_Y} subtitle={subtitle}>
                  {title}
                </BoardTitle>
                <ColumnHeadings x={x} y={BOARD_HEADINGS_Y} />
                {rows[board].map((entry, row) => (
                  <BoardRow
                    key={`${board}-${row}`}
                    rowKey={`${board}-${row}`}
                    order={row + (direction > 0 ? 0.5 : 0)}
                    entry={entry}
                    x={x}
                    y={FIRST_ROW_Y - row * ROW_PITCH}
                    selected={selection?.board === board && selection.row === row}
                    onSelect={() => onSelect({ board, row })}
                  />
                ))}
              </group>
            );
          })}
        </SplitFlapBatch>
      </group>
    </group>
  );
}

export { BOARD_WIDTH };
