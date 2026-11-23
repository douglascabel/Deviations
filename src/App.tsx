import { useEffect, useState } from 'react';
import TWABoardHousing from './components/TWABoardHousing';
import { emptyFeed, getMockFeed } from './data/mockFeed';

export default function App() {
  const [entries, setEntries] = useState(emptyFeed);
  const [feedVersion, setFeedVersion] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntries(getMockFeed(0)));
    return () => cancelAnimationFrame(frame);
  }, []);

  const refreshFeed = () => {
    const nextVersion = feedVersion + 1;
    setFeedVersion(nextVersion);
    setEntries(getMockFeed(nextVersion));
  };

  return (
    <main className="relative isolate flex h-full min-h-[560px] flex-col overflow-hidden bg-[#e9e3d8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(255,250,239,0.82)_0%,rgba(238,229,212,0.2)_52%,rgba(197,179,150,0.18)_100%)]" />
      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8">
        <a href="#" className="pointer-events-auto text-[11px] font-semibold uppercase tracking-[0.3em] text-[#3b433f] no-underline">
          Deviations
        </a>
        <p className="hidden text-[10px] uppercase tracking-[0.22em] text-[#767668] sm:block">
          A departure board for the future
        </p>
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#6d756c]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#709776] shadow-[0_0_10px_#709776]" />
          Feed / {String(feedVersion + 1).padStart(2, '0')}
        </span>
      </header>

      <section className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="absolute inset-0">
          <TWABoardHousing entries={entries} />
        </div>
        <div className="pointer-events-none absolute bottom-7 left-6 z-10 hidden max-w-48 text-[10px] leading-relaxed tracking-[0.12em] text-[#777263] sm:block">
          ALL TIMES ARE LOCAL<br />
          TO THE PRESENT MOMENT
        </div>
        <button
          type="button"
          onClick={refreshFeed}
          className="absolute bottom-7 right-6 z-10 inline-flex items-center gap-3 border border-[#596058]/35 bg-[#eee8dc]/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#303833] shadow-[0_8px_24px_rgba(70,60,44,0.12)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#596058]/70 hover:bg-[#f8f4ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#596058] sm:right-10 sm:bottom-9"
        >
          <span className="text-sm leading-none" aria-hidden="true">↻</span>
          Refresh Feed
        </button>
      </section>
    </main>
  );
}
