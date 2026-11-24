import { useEffect, useState } from 'react';
import TWABoardHousing from './components/TWABoardHousing';
import { emptyFeed, getAmbientEntry, getMockFeed } from './data/mockFeed';
import { muteSound, unmuteSound } from './utils/soundEngine';

export default function App() {
  const [entries, setEntries] = useState(emptyFeed);
  const [feedVersion, setFeedVersion] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntries(getMockFeed(0)));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let timer = 0;
    const scheduleNextFlip = () => {
      timer = window.setTimeout(() => {
        setEntries((current) => {
          const index = Math.floor(Math.random() * current.length);
          const next = getAmbientEntry(current.filter((_, entryIndex) => entryIndex !== index).map(({ code }) => code));
          return current.map((entry, entryIndex) => entryIndex === index ? next : entry);
        });
        scheduleNextFlip();
      }, 4000 + Math.random() * 41000);
    };

    scheduleNextFlip();
    return () => window.clearTimeout(timer);
  }, []);

  const refreshFeed = () => {
    const nextVersion = feedVersion + 1;
    setFeedVersion(nextVersion);
    setEntries(getMockFeed(nextVersion));
    setSelectedIndex(null);
  };

  const selectedEntry = selectedIndex === null ? null : entries[selectedIndex];
  const toggleSound = async () => {
    if (isMuted) {
      await unmuteSound();
      setIsMuted(false);
    } else {
      muteSound();
      setIsMuted(true);
    }
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
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={isMuted ? 'Unmute mechanical sound effects' : 'Mute mechanical sound effects'}
            aria-pressed={!isMuted}
            className="pointer-events-auto border border-[#596058]/30 bg-[#eee8dc]/70 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#454c45] backdrop-blur transition hover:border-[#596058]/65 hover:bg-[#f8f4ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#596058]"
          >
            {isMuted ? 'Sound off' : 'Sound on'}
          </button>
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#6d756c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#709776] shadow-[0_0_10px_#709776]" />
            Feed / {String(feedVersion + 1).padStart(2, '0')}
          </span>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="absolute inset-0">
          <TWABoardHousing
            entries={entries}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
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
        {selectedEntry ? (
          <aside
            role="dialog"
            aria-modal="false"
            aria-labelledby="inspection-title"
            className="absolute right-5 top-1/2 z-20 w-[min(360px,90vw)] -translate-y-1/2 border border-white/60 bg-[#f7f3eb]/85 p-6 text-[#313833] shadow-[0_24px_70px_rgba(54,48,38,0.22)] backdrop-blur-xl sm:right-10 sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between border-b border-[#656b61]/20 pb-3">
              <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#7d786b]">
                {selectedIndex !== null && selectedIndex < 6 ? 'Departure' : 'Arrival'} / {selectedEntry.code.trim()}
              </span>
            </div>
            <h2 id="inspection-title" className="font-serif text-2xl leading-tight tracking-wide">
              {selectedEntry.destination.trim()}
            </h2>
            <dl className="my-5 grid grid-cols-2 gap-4 border-y border-[#656b61]/15 py-4">
              <div>
                <dt className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#828073]">Gate</dt>
                <dd className="text-xs font-medium tracking-[0.12em]">{selectedEntry.gate.trim()}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#828073]">Target year</dt>
                <dd className="text-xs font-medium tracking-[0.12em]">{selectedEntry.targetYear}</dd>
              </div>
              <div className="col-span-2">
                <dt className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#828073]">Board status</dt>
                <dd className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b2638]">
                  {selectedEntry.status.trim()}
                </dd>
              </div>
            </dl>
            <p className="text-[13px] leading-relaxed text-[#5b6058]">{selectedEntry.summary}</p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <a
                href={selectedEntry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7e2936] underline decoration-[#9b2638]/35 underline-offset-4 hover:decoration-[#9b2638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9b2638]"
              >
                Read Source ↗
              </a>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="border border-[#596058]/30 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#454c45] transition hover:border-[#596058]/70 hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#596058]"
              >
                Back to Board
              </button>
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
