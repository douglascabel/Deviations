export type Category = 'ECO' | 'FIN' | 'SOC';

export interface BoardEntry {
  category: Category;
  code: string;
  target: string;
  region: string;
  status: string;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  ECO: '#5d9672',
  FIN: '#d3a64e',
  SOC: '#5b7fbd',
};

const promises: BoardEntry[] = [
  { category: 'ECO', code: 'COP28', target: '1.5C CLIMATE LIMIT', region: 'GLBL', status: 'DELAYED' },
  { category: 'FIN', code: 'TAX01', target: 'TAX THE ULTRA-RICH', region: 'G20', status: 'PENDING' },
  { category: 'SOC', code: 'HOU07', target: 'HOUSING FOR ALL', region: 'EMEA', status: 'ON HOLD' },
  { category: 'ECO', code: 'OCEAN', target: 'END DEEP SEA MINING', region: 'PACF', status: 'REROUTED' },
  { category: 'FIN', code: 'AID24', target: 'CLIMATE REPARATIONS', region: 'GLBL', status: 'IN REVIEW' },
  { category: 'SOC', code: 'CARE5', target: 'UNIVERSAL CHILDCARE', region: 'AMER', status: 'DELAYED' },
];

const realities: BoardEntry[] = [
  { category: 'ECO', code: 'FOSS1', target: 'NEW OIL, SAME STORY', region: 'GLBL', status: 'BOARDING' },
  { category: 'FIN', code: 'LOBBY', target: 'SUBSIDIES AS USUAL', region: 'G20', status: 'ON TIME' },
  { category: 'SOC', code: 'RENT2', target: 'RENTS OUTPACE WAGES', region: 'EMEA', status: 'OVERBOOKED' },
  { category: 'ECO', code: 'WASTE', target: 'PLASTIC EXPORTS UP', region: 'APAC', status: 'NO GATE' },
  { category: 'FIN', code: 'DEBT0', target: 'GLOBAL SOUTH DEBT', region: 'GLBL', status: 'CANCELLED' },
  { category: 'SOC', code: 'GIG00', target: 'WORKER SAFETY NET', region: 'AMER', status: 'DELAYED' },
];

const MAX_LENGTHS = { code: 5, target: 22, region: 4, status: 10 } as const;

function fit(value: string, length: number): string {
  return value.toUpperCase().slice(0, length).padEnd(length, ' ');
}

export function formatEntry(entry: BoardEntry): BoardEntry {
  return {
    ...entry,
    code: fit(entry.code, MAX_LENGTHS.code),
    target: fit(entry.target, MAX_LENGTHS.target),
    region: fit(entry.region, MAX_LENGTHS.region),
    status: fit(entry.status, MAX_LENGTHS.status),
  };
}

export function getMockFeed(variant = 0): BoardEntry[] {
  const shuffled = (entries: BoardEntry[], offset: number) =>
    entries.map((_, index) => entries[(index + offset) % entries.length]);

  return [...shuffled(promises, variant % promises.length), ...shuffled(realities, (variant * 3) % realities.length)]
    .map(formatEntry);
}

export function emptyFeed(): BoardEntry[] {
  return Array.from({ length: 12 }, (_, index) => ({
    category: (['ECO', 'FIN', 'SOC'] as const)[index % 3],
    code: '     ',
    target: '                      ',
    region: '    ',
    status: '          ',
  }));
}
