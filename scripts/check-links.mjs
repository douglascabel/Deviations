// Checks every official source link in the satirical pool. Run locally: npm run check-links
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/data/governancePool.ts', import.meta.url), 'utf8');
const urls = [...new Set([...source.matchAll(/sourceUrl:\s*["']([^"']+)["']/g)].map((match) => match[1]))];
let failures = 0;

for (const url of urls) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (link check)' },
      signal: AbortSignal.timeout(20_000),
    });
    const ok = response.status < 400;
    if (!ok) failures += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${response.status} ${url}${response.url !== url ? ` -> ${response.url}` : ''}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ---  ${url} (${error instanceof Error ? error.message : error})`);
  }
}

console.log(`\n${urls.length - failures}/${urls.length} links reachable.`);
process.exitCode = failures > 0 ? 1 : 0;
