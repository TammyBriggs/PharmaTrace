import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const arrow =
  'absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full ' +
  'border border-line bg-white text-brand shadow-card transition hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-brand';

/**
 * Single-row card strip. Children size themselves with CARD_BASIS so four fit the frame on
 * wide screens. A floating arrow appears only in a direction that still has cards to reveal,
 * and each click moves the strip by exactly one card.
 */
export const CARD_BASIS = 'shrink-0 snap-start basis-[calc((100%-1rem)/2)] xl:basis-[calc((100%-3rem)/4)]';

export default function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [update, children]);

  function move(dir: 1 | -1) {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (first.offsetWidth + gap), behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} role="group" aria-label={label} tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {canLeft && (
        <button type="button" onClick={() => move(-1)} aria-label="Show previous metrics" className={`${arrow} left-2`}>
          <ChevronLeft size={20} />
        </button>
      )}
      {canRight && (
        <button type="button" onClick={() => move(1)} aria-label="Show more metrics" className={`${arrow} right-2`}>
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
