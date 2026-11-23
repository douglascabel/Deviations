export type Category = 'ECO' | 'FIN' | 'SOC';

export interface BoardEntry {
  category: Category;
  code: string;
  target: string;
  region: string;
  status: string;
  targetYear: string;
  summary: string;
  sourceUrl: string;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  ECO: '#5d9672',
  FIN: '#d3a64e',
  SOC: '#5b7fbd',
};

const promises: BoardEntry[] = [
  { category: 'ECO', code: 'COP28', target: '1.5C CLIMATE LIMIT', region: 'GLBL', status: 'DELAYED', targetYear: '2030', summary: 'Countries agreed to pursue efforts to limit warming to 1.5°C, but current policies still point well beyond that threshold.', sourceUrl: 'https://www.un.org/en/climatechange/paris-agreement' },
  { category: 'FIN', code: 'TAX01', target: 'TAX THE ULTRA-RICH', region: 'G20', status: 'PENDING', targetYear: '2024', summary: 'The G20 began discussing international cooperation on taxing the super-rich, while implementation remains a national choice.', sourceUrl: 'https://www.oecd.org/tax/' },
  { category: 'SOC', code: 'HOU07', target: 'HOUSING FOR ALL', region: 'EMEA', status: 'ON HOLD', targetYear: '2030', summary: 'UN Sustainable Development Goal 11 calls for adequate, safe and affordable housing for everyone by 2030.', sourceUrl: 'https://sdgs.un.org/goals/goal11' },
  { category: 'ECO', code: 'OCEAN', target: 'END DEEP SEA MINING', region: 'PACF', status: 'REROUTED', targetYear: '2025', summary: 'The International Seabed Authority continues negotiating mining rules as calls for a precautionary pause grow.', sourceUrl: 'https://www.isa.org.jm/the-mining-code/' },
  { category: 'FIN', code: 'AID24', target: 'CLIMATE REPARATIONS', region: 'GLBL', status: 'IN REVIEW', targetYear: '2023', summary: 'A loss-and-damage fund was agreed at COP28, but pledges so far remain small beside estimated climate-related needs.', sourceUrl: 'https://unfccc.int/loss-and-damage-fund-joint-interim-secretariat' },
  { category: 'SOC', code: 'CARE5', target: 'UNIVERSAL CHILDCARE', region: 'AMER', status: 'DELAYED', targetYear: '2030', summary: "Access to affordable childcare remains uneven, limiting family choices and women's participation in paid work.", sourceUrl: 'https://www.unicef.org/reports/where-do-rich-countries-stand-childcare' },
];

const realities: BoardEntry[] = [
  { category: 'ECO', code: 'FOSS1', target: 'NEW OIL, SAME STORY', region: 'GLBL', status: 'BOARDING', targetYear: '2024', summary: 'Despite climate targets, oil and gas production plans remain inconsistent with limiting warming to 1.5°C.', sourceUrl: 'https://productiongap.org/' },
  { category: 'FIN', code: 'LOBBY', target: 'SUBSIDIES AS USUAL', region: 'G20', status: 'ON TIME', targetYear: '2025', summary: 'Governments continue supporting fossil fuels even as they commit to phasing out inefficient subsidies.', sourceUrl: 'https://www.iea.org/topics/energy-subsidies' },
  { category: 'SOC', code: 'RENT2', target: 'RENTS OUTPACE WAGES', region: 'EMEA', status: 'OVERBOOKED', targetYear: '2024', summary: 'Housing costs have risen faster than incomes in many cities, intensifying affordability pressures.', sourceUrl: 'https://www.oecd.org/housing/' },
  { category: 'ECO', code: 'WASTE', target: 'PLASTIC EXPORTS UP', region: 'APAC', status: 'NO GATE', targetYear: '2024', summary: 'International rules restrict some plastic waste exports, while enforcement and global trade flows remain challenging.', sourceUrl: 'https://www.basel.int/Implementation/Plasticwaste/Overview/tabid/8347/Default.aspx' },
  { category: 'FIN', code: 'DEBT0', target: 'GLOBAL SOUTH DEBT', region: 'GLBL', status: 'CANCELLED', targetYear: '2025', summary: 'Debt service burdens constrain public spending in many low- and middle-income countries.', sourceUrl: 'https://www.un.org/sustainabledevelopment/financing-for-development/' },
  { category: 'SOC', code: 'GIG00', target: 'WORKER SAFETY NET', region: 'AMER', status: 'DELAYED', targetYear: '2024', summary: 'Many platform workers still lack the protections and benefits commonly tied to traditional employment.', sourceUrl: 'https://www.ilo.org/topics-and-sectors/platform-work' },
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
    targetYear: '',
    summary: '',
    sourceUrl: '',
  }));
}
