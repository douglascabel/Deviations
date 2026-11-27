import { useEffect, useState } from 'react';
import TWABoardHousing, { type Selection } from './components/TWABoardHousing';
import {
  ROTATION_PERIOD,
  ROWS_PER_BOARD,
  ambientFlip,
  emptyBoardState,
  initialBoardState,
  msUntilNextRotation,
  rotationDay,
  type Board,
  type BoardState,
} from './data/governanceService';
import { muteSound, unmuteSound } from './utils/soundEngine';

/** True on narrow portrait screens (phones), where one board is framed at a time. */
function useCompactLayout(): boolean {
  const query = '(max-aspect-ratio: 1/1) and (max-width: 820px)';
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setCompact(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return compact;
}

function dayStamp(day: number): string {
  const date = new Date(day * ROTATION_PERIOD);
  return date.toISOString().slice(0, 10).replace(/-/g, '.');
}

export default function App() {
  const [board, setBoard] = useState<BoardState>(emptyBoardState);
  const [reshuffle, setReshuffle] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const compact = useCompactLayout();
  const [focusBoard, setFocusBoard] = useState<Board>('departures');

  // Populate after the first frame so the opening cascade is visible, then check the 24-hour
  // rotation on a timer aligned to the boundary, and again whenever the tab regains focus.
  useEffect(() => {
    const start = window.setTimeout(() => setBoard(initialBoardState(rotationDay(), reshuffle)), 600);
    const sync = () => {
      setBoard((current) => {
        const day = rotationDay();
        return day === current.day && current.queues.departures.length > 0
          ? current
          : initialBoardState(day, reshuffle);
      });
    };
    let interval = 0;
    const align = window.setTimeout(() => {
      sync();
      interval = window.setInterval(sync, ROTATION_PERIOD);
    }, msUntilNextRotation() + 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(align);
      window.clearInterval(interval);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reshuffle]);

  // Ambient flips: every 6 to 30 seconds one row on one board turns over to the next item in its queue.
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBoard((current) => {
          const side: Board = Math.random() < 0.5 ? 'departures' : 'arrivals';
          const row = Math.floor(Math.random() * ROWS_PER_BOARD);
          if (selection?.board === side && selection.row === row) return current;
          return ambientFlip(current, side, row);
        });
        schedule();
      }, 6000 + Math.random() * 24000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [selection]);

  const toggleSound = async () => {
    if (isMuted) {
      await unmuteSound();
      setIsMuted(false);
    } else {
      muteSound();
      setIsMuted(true);
    }
  };

  const selectedItem = selection ? board[selection.board][selection.row]?.item ?? null : null;
  const selectedStatus = selection ? board[selection.board][selection.row]?.status.trim() : '';

  return (
    <main className="relative isolate flex h-full min-h-[560px] flex-col overflow-hidden bg-[#dfe6e8]">
      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-4 pt-5 sm:px-10 sm:pt-8">
        <div>
          <a href="#" className="pointer-events-auto text-[11px] font-semibold uppercase tracking-[0.3em] text-[#2f3733] no-underline">
            Deviations
          </a>
          <p className="mt-1 hidden text-[10px] uppercase tracking-[0.22em] text-[#4f5852] sm:block">
            A departure board for the future
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#4f5852] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#709776] shadow-[0_0_10px_#709776]" />
            Rotation {dayStamp(board.day)}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={isMuted ? 'Unmute split-flap sound' : 'Mute split-flap sound'}
            aria-pressed={!isMuted}
            className="pointer-events-auto border border-[#596058]/30 bg-[#eef1ee]/75 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#3b433d] backdrop-blur transition hover:border-[#596058]/65 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#596058]"
          >
            {isMuted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="absolute inset-0">
          <TWABoardHousing
            departures={board.departures}
            arrivals={board.arrivals}
            selection={selection}
            onSelect={setSelection}
            focus={compact ? focusBoard : null}
          />
        </div>
        <p className="pointer-events-none absolute bottom-7 left-4 z-10 hidden max-w-56 text-[10px] leading-relaxed tracking-[0.12em] text-[#4a504a] sm:left-6 sm:block">
          SATIRE. ENTRIES PARODY REAL<br />
          INITIATIVES; SOURCES ARE OFFICIAL.
        </p>
        {compact ? (
          <div
            role="group"
            aria-label="Board"
            className="absolute bottom-6 left-4 z-10 flex border border-[#596058]/35 bg-[#eef1ee]/80 backdrop-blur"
          >
            {(['departures', 'arrivals'] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={focusBoard === side}
                onClick={() => {
                  setSelection(null);
                  setFocusBoard(side);
                }}
                className={`px-3 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#596058] ${
                  focusBoard === side ? 'bg-[#2c332e] text-[#f3f1ea]' : 'text-[#2c332e]'
                }`}
              >
                {side === 'departures' ? 'Departures' : 'Arrivals'}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          aria-label="Reshuffle board"
          onClick={() => {
            setSelection(null);
            setReshuffle((value) => value + 1);
          }}
          className="absolute bottom-6 right-4 z-10 inline-flex items-center gap-3 border border-[#596058]/35 bg-[#eef1ee]/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2c332e] shadow-[0_8px_24px_rgba(40,50,50,0.14)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#596058]/70 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#596058] sm:right-10 sm:bottom-9"
        >
          <span className="text-sm leading-none" aria-hidden="true">↻</span>
          <span className={compact ? 'sr-only' : undefined}>Reshuffle Board</span>
        </button>
        {selection && selectedItem ? (
          <aside
            role="dialog"
            aria-modal="false"
            aria-labelledby="dossier-title"
            className="absolute inset-x-4 bottom-20 z-20 max-h-[50%] overflow-y-auto border border-white/60 bg-[#f6f4ee]/90 p-6 text-[#2c332e] shadow-[0_24px_70px_rgba(30,40,40,0.25)] backdrop-blur-xl sm:inset-x-auto sm:bottom-auto sm:right-10 sm:top-1/2 sm:w-[380px] sm:-translate-y-1/2 sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between border-b border-[#656b61]/20 pb-3">
              <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#6f6a5d]">
                {selection.board === 'departures' ? 'Departure' : 'Arrival'} / {selectedItem.code}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#9b2638]">Satire</span>
            </div>
            <h2 id="dossier-title" className="font-serif text-2xl leading-tight tracking-wide">
              {selectedItem.title}
            </h2>
            <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[#6f6a5d]">{selectedItem.body}</p>
            <dl className="my-5 grid grid-cols-2 gap-4 border-y border-[#656b61]/15 py-4">
              <div>
                <dt className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#77746a]">Target</dt>
                <dd className="text-xs font-medium tracking-[0.12em]">{selectedItem.target}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#77746a]">Status</dt>
                <dd className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b2638]">{selectedStatus}</dd>
              </div>
              {selectedItem.slipped ? (
                <div className="col-span-2">
                  <dt className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#77746a]">Schedule history</dt>
                  <dd className="text-xs leading-relaxed tracking-[0.04em]">{selectedItem.slipped}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-[13px] leading-relaxed text-[#4f554d]">{selectedItem.dossier}</p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <a
                href={selectedItem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7e2936] underline decoration-[#9b2638]/35 underline-offset-4 hover:decoration-[#9b2638] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9b2638]"
              >
                {selectedItem.sourceLabel} ↗
              </a>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="border border-[#596058]/30 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#3b433d] transition hover:border-[#596058]/70 hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#596058]"
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
