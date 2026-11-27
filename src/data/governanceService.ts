import { GOVERNANCE_POOL, type Board, type GovernanceItem } from './governancePool';

export type { Board, GovernanceItem };

/** The board rotates its featured initiatives and advances status tags once every 24 hours. */
export const ROTATION_PERIOD = 86_400_000;
export const ROWS_PER_BOARD = 7;

/** Board column widths, in flap cells. 5 + 2 + 16 + 1 + 4 + 1 + 12 = 41. */
export const COLUMN_WIDTHS = { code: 5, initiative: 16, target: 4, status: 12 } as const;

export interface BoardEntry {
  id: string;
  board: Board;
  /** Fixed-width strings, exactly as the flaps display them. */
  code: string;
  initiative: string;
  target: string;
  status: string;
  item: GovernanceItem | null;
}

export const STATUS_COLORS: Record<string, { background: string; foreground: string }> = {
  // Departures
  PLEDGED: { background: '#1F7A72', foreground: '#FFFFFF' },
  DRAFTING: { background: '#34557A', foreground: '#FFFFFF' },
  CONVENING: { background: '#5A4A86', foreground: '#FFFFFF' },
  RATIFYING: { background: '#D99B00', foreground: '#141414' },
  SIGNED: { background: '#1B7A43', foreground: '#FFFFFF' },
  // Arrivals
  DELAYED: { background: '#D99B00', foreground: '#141414' },
  'RE-BASELINED': { background: '#D9531E', foreground: '#FFFFFF' },
  'UNDER REVIEW': { background: '#3D4850', foreground: '#FFFFFF' },
  POSTPONED: { background: '#A8431F', foreground: '#FFFFFF' },
  MISSED: { background: '#C81E2B', foreground: '#FFFFFF' },
};

export function rotationDay(now = Date.now()): number {
  return Math.floor(now / ROTATION_PERIOD);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fit(value: string, length: number): string {
  return value.toUpperCase().slice(0, length).padEnd(length, ' ');
}

/** Each item starts at its own point in its status cycle and moves one step per day. */
export function statusFor(item: GovernanceItem, day: number): string {
  return item.statuses[(day + hash(item.id)) % item.statuses.length];
}

export function toEntry(item: GovernanceItem, day: number): BoardEntry {
  return {
    id: item.id,
    board: item.board,
    code: fit(item.code, COLUMN_WIDTHS.code),
    initiative: fit(item.initiative, COLUMN_WIDTHS.initiative),
    target: fit(item.target, COLUMN_WIDTHS.target),
    status: fit(statusFor(item, day), COLUMN_WIDTHS.status),
    item,
  };
}

export function blankEntry(board: Board): BoardEntry {
  return {
    id: `blank-${board}`,
    board,
    code: ' '.repeat(COLUMN_WIDTHS.code),
    initiative: ' '.repeat(COLUMN_WIDTHS.initiative),
    target: ' '.repeat(COLUMN_WIDTHS.target),
    status: ' '.repeat(COLUMN_WIDTHS.status),
    item: null,
  };
}

/**
 * A day's running order for one board: the whole pool for that board, shuffled with a seed
 * derived from the day. The first ROWS_PER_BOARD items are featured; ambient flips then walk
 * the rest of the queue in order, so nothing repeats until the pool is exhausted.
 */
export function dailyQueue(board: Board, day: number, reshuffle = 0): GovernanceItem[] {
  const items = GOVERNANCE_POOL.filter((item) => item.board === board);
  const random = mulberry32(hash(`${board}:${day}:${reshuffle}`));
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

export interface BoardState {
  day: number;
  departures: BoardEntry[];
  arrivals: BoardEntry[];
  queues: Record<Board, GovernanceItem[]>;
  cursors: Record<Board, number>;
}

export function initialBoardState(day = rotationDay(), reshuffle = 0): BoardState {
  const queues = {
    departures: dailyQueue('departures', day, reshuffle),
    arrivals: dailyQueue('arrivals', day, reshuffle),
  };
  return {
    day,
    departures: queues.departures.slice(0, ROWS_PER_BOARD).map((item) => toEntry(item, day)),
    arrivals: queues.arrivals.slice(0, ROWS_PER_BOARD).map((item) => toEntry(item, day)),
    queues,
    cursors: { departures: ROWS_PER_BOARD, arrivals: ROWS_PER_BOARD },
  };
}

export function emptyBoardState(): BoardState {
  return {
    day: rotationDay(),
    departures: Array.from({ length: ROWS_PER_BOARD }, () => blankEntry('departures')),
    arrivals: Array.from({ length: ROWS_PER_BOARD }, () => blankEntry('arrivals')),
    queues: { departures: [], arrivals: [] },
    cursors: { departures: 0, arrivals: 0 },
  };
}

/** Replace one row with the next item in that board's queue that isn't already on display. */
export function ambientFlip(state: BoardState, board: Board, row: number): BoardState {
  const queue = state.queues[board];
  if (queue.length === 0) return state;
  const rows = state[board];
  const shown = new Set(rows.map((entry) => entry.id));
  let cursor = state.cursors[board];
  let next: GovernanceItem | undefined;
  for (let attempt = 0; attempt < queue.length; attempt += 1) {
    const candidate = queue[(cursor + attempt) % queue.length];
    if (!shown.has(candidate.id)) {
      next = candidate;
      cursor += attempt + 1;
      break;
    }
  }
  if (!next) return state;
  return {
    ...state,
    [board]: rows.map((entry, index) => (index === row ? toEntry(next, state.day) : entry)),
    cursors: { ...state.cursors, [board]: cursor % queue.length },
  };
}

/** Milliseconds until the next 24-hour rotation boundary (UTC midnight). */
export function msUntilNextRotation(now = Date.now()): number {
  return ROTATION_PERIOD - (now % ROTATION_PERIOD);
}
