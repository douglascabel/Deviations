import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const FEEDS = [
  { code: 'NYT', name: 'The New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { code: 'ATL', name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' },
  { code: 'WAPO', name: 'The Washington Post', url: 'https://feeds.washingtonpost.com/rss/world' },
  { code: 'RTRS', name: 'Reuters', url: 'https://www.reuters.com/rssFeed/worldNews' },
  { code: 'AP', name: 'AP News', url: 'https://apnews.com/apf-topnews?output=rss' },
  { code: 'GRD', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { code: 'NPR', name: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml' },
  { code: 'BBC', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
];
const OUTPUT = resolve('public/feed.json');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
      if (code[0] === '#') {
        const number = code[1].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
        return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
          ? String.fromCodePoint(number)
          : ' ';
      }
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[code.toLowerCase()] ?? ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const expression = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'i');
  return expression.exec(block)?.[1]?.trim() ?? '';
}

function linkFor(block) {
  const rssLink = tag(block, 'link');
  if (rssLink) return decodeXml(rssLink);
  const atomLink = /<link\b[^>]*href=["']([^"']+)["'][^>]*>/i.exec(block)?.[1];
  return atomLink ? decodeXml(atomLink) : '';
}

function parseFeed(xml, source, now) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)].map(([block]) => block);
  return blocks.flatMap((block, index) => {
    const title = decodeXml(tag(block, 'title'));
    const sourceUrl = linkFor(block);
    const rawDate = decodeXml(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated'));
    const published = Date.parse(rawDate);
    const publishedAt = Number.isFinite(published) ? new Date(published).toISOString() : '';
    const age = publishedAt ? now - published : Number.POSITIVE_INFINITY;
    if (!title || !/^https?:\/\//i.test(sourceUrl) || age < -60 * 60_000 || age > MAX_AGE_MS) return [];

    const flight = `${source.code.slice(0, 3)}${String(index + 1).padStart(2, '0')}`;
    return [{
      flight: flight.slice(0, 5),
      headline: title,
      title,
      time: '',
      status: '',
      publishedAt,
      source: source.name,
      summary: "Read the publisher's article for full coverage.",
      sourceUrl,
    }];
  });
}

async function readPreviousFeed() {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf8'));
  } catch {
    return [];
  }
}

const now = Date.now();
const results = await Promise.all(FEEDS.map(async (source) => {
  try {
    const response = await fetch(source.url, {
      headers: { 'user-agent': 'DeviationsNewsFeed/1.0 (+https://github.com/douglascabel/Deviations)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const entries = parseFeed(xml, source, now);
    console.log(`${source.name}: ${entries.length} recent articles`);
    return { source, entries, failed: false };
  } catch (error) {
    console.warn(`${source.name}: feed unavailable (${error.message})`);
    return { source, entries: [], failed: true };
  }
}));

const unique = new Map();
const freshEntries = results.flatMap(({ entries }) => entries);
for (const entry of freshEntries.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
  const key = entry.sourceUrl.replace(/\/$/, '').toLowerCase();
  if (!unique.has(key)) unique.set(key, entry);
}
let articles = [...unique.values()].slice(0, 72);
const unavailableSources = new Set(results.filter(({ failed }) => failed).map(({ source }) => source.name));
const previous = await readPreviousFeed();
const retainedEntries = Array.isArray(previous)
  ? previous.filter((entry) =>
      unavailableSources.has(entry?.source) &&
      entry?.sourceUrl &&
      Number.isFinite(Date.parse(entry.publishedAt)) &&
      Date.now() - Date.parse(entry.publishedAt) <= MAX_AGE_MS)
  : [];
const seen = new Set(articles.map(({ sourceUrl }) => sourceUrl.toLowerCase()));
articles = [
  ...articles,
  ...retainedEntries.filter(({ sourceUrl }) => !seen.has(sourceUrl.toLowerCase())),
].slice(0, 72);

if (articles.length < 12 && Array.isArray(previous)) {
  const previousEntries = previous.filter((entry) =>
    entry?.sourceUrl &&
    Number.isFinite(Date.parse(entry.publishedAt)) &&
    Date.now() - Date.parse(entry.publishedAt) <= MAX_AGE_MS);
  const existing = new Set(articles.map(({ sourceUrl }) => sourceUrl.toLowerCase()));
  articles = [
    ...articles,
    ...previousEntries.filter(({ sourceUrl }) => !existing.has(sourceUrl.toLowerCase())),
  ].slice(0, 72);
}
if (articles.length < 12) {
  throw new Error(`Only ${articles.length} recent articles are available; keeping the existing feed unchanged.`);
}

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(articles, null, 2)}\n`);
console.log(`Wrote ${articles.length} articles to ${OUTPUT}`);
