export interface BoardEntry {
  flight: string;
  headline: string;
  title: string;
  time: string;
  status: string;
  publishedAt: string;
  source: string;
  summary: string;
  sourceUrl: string;
}

const CACHE_KEY = 'deviations.article-feed.v2';
export const FEED_TTL = 86_400_000;
const BOARD_SIZE = 12;

interface CachedFeed {
  cachedAt: number;
  entries: BoardEntry[];
}

function isBoardEntry(value: unknown): value is BoardEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return ['flight', 'headline', 'title', 'time', 'publishedAt', 'source', 'summary', 'sourceUrl']
    .every((key) => typeof entry[key] === 'string') &&
    typeof entry.status === 'string' &&
    typeof entry.sourceUrl === 'string' &&
    /^https?:\/\//i.test(entry.sourceUrl);
}

function readCache(): CachedFeed | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    const cache = parsed as Record<string, unknown>;
    if (
      typeof cache.cachedAt !== 'number' ||
      !Array.isArray(cache.entries)
    ) return null;
    const entries = cache.entries.filter(isBoardEntry);
    if (entries.length !== cache.entries.length) return null;
    return { cachedAt: cache.cachedAt, entries };
  } catch (error) {
    console.warn('Could not read the cached article feed.', error);
    return null;
  }
}

function sanitize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .:/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fit(value: string, length: number): string {
  return sanitize(value).slice(0, length).padEnd(length, ' ');
}

function fitHeadline(value: string): string {
  const title = sanitize(value);
  if (title.length <= 18) return title.padEnd(18, ' ');
  const shortened = title.slice(0, 17);
  const boundary = shortened.lastIndexOf(' ');
  const readable = boundary >= 9 ? shortened.slice(0, boundary) : shortened.trimEnd();
  return `${readable.slice(0, 17)}.`.padEnd(18, ' ');
}

function relativeTime(publishedAt: string, now: number): string {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return '----';
  const ageMinutes = Math.max(0, Math.floor((now - published) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes}M`.padEnd(4, ' ');
  if (ageMinutes < 24 * 60) return `${Math.floor(ageMinutes / 60)}H`.padEnd(4, ' ');
  return `${Math.floor(ageMinutes / (24 * 60))}D`.slice(0, 4).padEnd(4, ' ');
}

function articleStatus(entry: BoardEntry, now: number): string {
  if (/\bLIVE\b/.test(sanitize(entry.title))) return 'LIVE';
  const published = Date.parse(entry.publishedAt);
  if (!Number.isFinite(published)) return 'UPDATED';
  const age = Math.max(0, now - published);
  if (age <= 60 * 60_000) return 'BREAKING';
  if (age <= 12 * 60 * 60_000) return 'UPDATED';
  if (age <= 48 * 60 * 60_000) return 'TRENDING';
  return 'ARCHIVED';
}

export function formatEntry(entry: BoardEntry, now = Date.now()): BoardEntry {
  return {
    ...entry,
    flight: fit(entry.flight, 5),
    headline: fitHeadline(entry.title || entry.headline),
    time: relativeTime(entry.publishedAt, now),
    status: fit(articleStatus(entry, now), 10),
  };
}

function parseFeed(payload: unknown): BoardEntry[] {
  if (!Array.isArray(payload)) throw new Error('The article feed response is not a list.');
  const entries = payload.filter(isBoardEntry);
  if (entries.length === 0) throw new Error('The article feed contains no usable articles.');
  return entries.map((entry) => formatEntry(entry));
}

export async function refreshArticleFeed(): Promise<BoardEntry[]> {
  const cacheVersion = Date.now();
  const response = await fetch(`${import.meta.env.BASE_URL}feed.json?v=${cacheVersion}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`The article feed returned HTTP ${response.status}.`);
  const entries = parseFeed(await response.json());
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), entries }));
  } catch (error) {
    console.warn('Could not save the article feed cache.', error);
  }
  return entries;
}

export async function loadArticleFeed(): Promise<BoardEntry[]> {
  const cached = readCache();
  if (cached && Date.now() - cached.cachedAt < FEED_TTL) {
    return cached.entries.map((entry) => formatEntry(entry));
  }
  return refreshArticleFeed();
}

export function getCachedArticleFeed(): BoardEntry[] {
  return readCache()?.entries.map((entry) => formatEntry(entry)) ?? [];
}

export function selectBoardEntries(feed: BoardEntry[], offset = 0): BoardEntry[] {
  if (feed.length === 0) return emptyFeed();
  return Array.from({ length: BOARD_SIZE }, (_, index) =>
    formatEntry(feed[(offset + index) % feed.length]),
  );
}

export function getAmbientEntry(feed: BoardEntry[], excludedCodes: string[]): BoardEntry {
  const excluded = new Set(excludedCodes);
  const candidates = feed.filter((entry) => !excluded.has(entry.flight.trim()));
  const pool = candidates.length > 0 ? candidates : feed;
  return formatEntry(pool[Math.floor(Math.random() * pool.length)]);
}

export function emptyFeed(): BoardEntry[] {
  return Array.from({ length: BOARD_SIZE }, () => ({
    flight: '     ',
    headline: '                  ',
    title: '',
    time: '    ',
    status: '          ',
    publishedAt: '',
    source: '',
    summary: '',
    sourceUrl: '',
  }));
}
