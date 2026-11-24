export type Category = 'ECO' | 'FIN' | 'SOC';

export interface BoardEntry {
  category: Category;
  code: string;
  destination: string;
  gate: string;
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
  { category: 'ECO', code: 'COP28', destination: '1.5C CLIMATE LIMIT', gate: 'GLBL', status: 'DELAYED', targetYear: '2030', summary: 'Countries agreed to pursue efforts to limit warming to 1.5°C, but current policies still point well beyond that threshold.', sourceUrl: 'https://www.un.org/en/climatechange/paris-agreement' },
  { category: 'FIN', code: 'TAX01', destination: 'TAX THE ULTRA-RICH', gate: 'G20', status: 'REVIEWING', targetYear: '2024', summary: 'The G20 began discussing international cooperation on taxing the super-rich, while implementation remains a national choice.', sourceUrl: 'https://www.oecd.org/tax/' },
  { category: 'SOC', code: 'HOU07', destination: 'HOUSING FOR ALL', gate: 'EMEA', status: 'SLIPPED', targetYear: '2030', summary: 'UN Sustainable Development Goal 11 calls for adequate, safe and affordable housing for everyone by 2030.', sourceUrl: 'https://sdgs.un.org/goals/goal11' },
  { category: 'ECO', code: 'OCEAN', destination: 'DEEP SEA MINING', gate: 'APAC', status: 'REROUTED', targetYear: '2025', summary: 'The International Seabed Authority continues negotiating mining rules as calls for a precautionary pause grow.', sourceUrl: 'https://www.isa.org.jm/the-mining-code/' },
  { category: 'FIN', code: 'AID24', destination: 'CLIMATE REPARATION', gate: 'GLBL', status: 'REVIEWING', targetYear: '2023', summary: 'A loss-and-damage fund was agreed at COP28, but pledges so far remain small beside estimated climate-related needs.', sourceUrl: 'https://unfccc.int/loss-and-damage-fund-joint-interim-secretariat' },
  { category: 'SOC', code: 'CARE5', destination: 'CHILDCARE FOR ALL', gate: 'AMER', status: 'DELAYED', targetYear: '2030', summary: "Access to affordable childcare remains uneven, limiting family choices and women's participation in paid work.", sourceUrl: 'https://www.unicef.org/reports/where-do-rich-countries-stand-childcare' },
];

const realities: BoardEntry[] = [
  { category: 'ECO', code: 'FOSS1', destination: 'NEW OIL, OLD STORY', gate: 'GLBL', status: 'ABANDONED', targetYear: '2024', summary: 'Despite climate targets, oil and gas production plans remain inconsistent with limiting warming to 1.5°C.', sourceUrl: 'https://productiongap.org/' },
  { category: 'FIN', code: 'LOBBY', destination: 'SUBSIDIES AS USUAL', gate: 'G20', status: 'ON TRACK', targetYear: '2025', summary: 'Governments continue supporting fossil fuels even as they commit to phasing out inefficient subsidies.', sourceUrl: 'https://www.iea.org/topics/energy-subsidies' },
  { category: 'SOC', code: 'RENT2', destination: 'RENTS BEAT WAGES', gate: 'EMEA', status: 'DELAYED', targetYear: '2024', summary: 'Housing costs have risen faster than incomes in many cities, intensifying affordability pressures.', sourceUrl: 'https://www.oecd.org/housing/' },
  { category: 'ECO', code: 'WASTE', destination: 'PLASTIC EXPORTS UP', gate: 'APAC', status: 'REROUTED', targetYear: '2024', summary: 'International rules restrict some plastic waste exports, while enforcement and global trade flows remain challenging.', sourceUrl: 'https://www.basel.int/Implementation/Plasticwaste/Overview/tabid/8347/Default.aspx' },
  { category: 'FIN', code: 'DEBT0', destination: 'GLOBAL SOUTH DEBT', gate: 'GLBL', status: 'CANCELLED', targetYear: '2025', summary: 'Debt service burdens constrain public spending in many low- and middle-income countries.', sourceUrl: 'https://www.un.org/sustainabledevelopment/financing-for-development/' },
  { category: 'SOC', code: 'GIG00', destination: 'WORKER SAFETY NET', gate: 'AMER', status: 'SLIPPED', targetYear: '2024', summary: 'Many platform workers still lack the protections and benefits commonly tied to traditional employment.', sourceUrl: 'https://www.ilo.org/topics-and-sectors/platform-work' },
];

const ambientEntries: BoardEntry[] = [
  { category: 'ECO', code: 'NET00', destination: 'ZERO NET BY LATER', gate: 'GLBL', status: 'SLIPPED', targetYear: '2050', summary: 'A distant target stays comfortably distant while near-term emissions continue to rise.', sourceUrl: 'https://www.un.org/en/climatechange/net-zero-coalition' },
  { category: 'FIN', code: 'BONUS', destination: 'BONUS BEFORE EARTH', gate: 'G20', status: 'ON TRACK', targetYear: '2028', summary: 'Executive incentives arrive on schedule; the promised transition plan is still being drafted.', sourceUrl: 'https://www.oecd.org/corporate/' },
  { category: 'SOC', code: 'WAGES', destination: 'LIVING WAGE SOON', gate: 'EMEA', status: 'REVIEWING', targetYear: '2027', summary: 'The living wage proposal is in its fourth round of stakeholder alignment.', sourceUrl: 'https://www.ilo.org/topics/wages' },
  { category: 'ECO', code: 'CARBN', destination: 'CARBON CUTS AHEAD', gate: 'APAC', status: 'REROUTED', targetYear: '2035', summary: 'The emissions pathway has been revised to include another decade of growth.', sourceUrl: 'https://www.unep.org/resources/emissions-gap-report' },
  { category: 'FIN', code: 'TAX02', destination: 'TAX LOOPHOLES END', gate: 'GLBL', status: 'DELAYED', targetYear: '2029', summary: 'A closure date is under review after a newly discovered exception was presented.', sourceUrl: 'https://www.oecd.org/tax/beps/' },
  { category: 'SOC', code: 'CARE6', destination: 'CARE WORK COUNTS', gate: 'AMER', status: 'ABANDONED', targetYear: '2026', summary: 'Care work was recognized as essential, then omitted from the final budget.', sourceUrl: 'https://www.ilo.org/topics-and-sectors/care-economy' },
  { category: 'ECO', code: 'FLAIR', destination: 'FLIGHTS NET ZERO', gate: 'EMEA', status: 'REVIEWING', targetYear: '2040', summary: 'Aviation targets rely on future fuels that have not yet reached commercial scale.', sourceUrl: 'https://www.iea.org/energy-system/transport/aviation' },
  { category: 'FIN', code: 'AID25', destination: 'AID, NO STRINGS', gate: 'GLBL', status: 'SLIPPED', targetYear: '2028', summary: 'The grant was approved, pending procurement of a sufficiently unconditional condition.', sourceUrl: 'https://www.oecd.org/dac/financing-sustainable-development/' },
  { category: 'SOC', code: 'RENT3', destination: 'RENT CAPS IN SIGHT', gate: 'EMEA', status: 'REROUTED', targetYear: '2027', summary: 'Affordable housing targets now prioritize premium units with optimistic names.', sourceUrl: 'https://www.oecd.org/housing/' },
  { category: 'ECO', code: 'OCE02', destination: 'OCEANS RESTORED', gate: 'PACF', status: 'DELAYED', targetYear: '2030', summary: 'Marine protection plans expanded on paper while extraction permits expanded at sea.', sourceUrl: 'https://www.un.org/bbnjagreement/en' },
  { category: 'FIN', code: 'DEBT1', destination: 'DEBT RELIEF NOW', gate: 'GLBL', status: 'CANCELLED', targetYear: '2026', summary: 'Debt restructuring talks concluded with another round of debt restructuring talks.', sourceUrl: 'https://www.imf.org/en/Topics/sovereign-debt' },
  { category: 'SOC', code: 'WORK1', destination: 'FOUR DAY WORKWEEK', gate: 'AMER', status: 'ON TRACK', targetYear: '2032', summary: 'A pilot is progressing after being rescheduled to a year with fewer working days.', sourceUrl: 'https://www.ilo.org/topics/working-time' },
];

const MAX_LENGTHS = { code: 5, destination: 18, gate: 4, status: 10 } as const;

function fit(value: string, length: number): string {
  return value.toUpperCase().slice(0, length).padEnd(length, ' ');
}

export function formatEntry(entry: BoardEntry): BoardEntry {
  return {
    ...entry,
    code: fit(entry.code, MAX_LENGTHS.code),
    destination: fit(entry.destination, MAX_LENGTHS.destination),
    gate: fit(entry.gate, MAX_LENGTHS.gate),
    status: fit(entry.status, MAX_LENGTHS.status),
  };
}

export function getMockFeed(variant = 0): BoardEntry[] {
  const shuffled = (entries: BoardEntry[], offset: number) =>
    entries.map((_, index) => entries[(index + offset) % entries.length]);

  return [...shuffled(promises, variant % promises.length), ...shuffled(realities, (variant * 3) % realities.length)]
    .map(formatEntry);
}

export function getAmbientEntry(excludedCodes: string[]): BoardEntry {
  const excluded = new Set(excludedCodes);
  const candidates = [...ambientEntries, ...promises, ...realities]
    .filter((entry) => !excluded.has(entry.code));
  const pool = candidates.length > 0 ? candidates : [...ambientEntries, ...promises, ...realities];
  return formatEntry(pool[Math.floor(Math.random() * pool.length)]);
}

export function emptyFeed(): BoardEntry[] {
  return Array.from({ length: 12 }, (_, index) => ({
    category: (['ECO', 'FIN', 'SOC'] as const)[index % 3],
    code: '     ',
    destination: '                  ',
    gate: '    ',
    status: '          ',
    targetYear: '',
    summary: '',
    sourceUrl: '',
  }));
}
