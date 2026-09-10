"use client";

import { useState } from "react";
import { ChevronFirstIcon, ChevronLastIcon, ChevronLeftIcon, ChevronRightIcon, ICON } from "@/components/xms/icons";
import { cn } from "@/lib/utils";

export interface TablePagerProps {
  /** One-based, as a reader counts. */
  page: number;
  pageSize: number;
  /** How many rows landed on this page; the last one is usually short. */
  onPage?: (page: number) => void;
  /** Everything the filter matches, where the server counts it. */
  total?: number;
  /** Rows on the page in hand, used when there is no total to count against. */
  rows: number;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  className?: string;
}

const STEP =
  "text-xms-icon hover:text-xms-accent hover:bg-xms-control-hover flex h-[26px] w-[26px] items-center justify-center rounded-[4px] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[color:var(--xms-icon)]";

/**
 * The pager, after the one the consultants already use: jump to the start,
 * step back, the page you are on in a box you can type into, what you are
 * looking at, step forward, jump to the end.
 *
 * Two of those depend on the server being able to count. A cursor-paged list
 * cannot say how many pages there are or leap to the last one, so where no
 * total is given the box is read-only and the jump to the end is not
 * offered. It says "1 to 25" instead of "1 to 25 of 8,803", which is the
 * truth rather than a number made up to fill the shape.
 */
export function TablePager({
  page,
  pageSize,
  total,
  rows,
  onPage,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  hasPrevious,
  hasNext,
  className,
}: TablePagerProps) {
  const [typed, setTyped] = useState(String(page));
  // The box follows the page whenever it moves for any other reason: a step,
  // a jump, or a filter that put the reader back on the first one. Derived
  // during the render rather than in an effect, which is the shape the rest
  // of the product uses for state that follows a prop.
  const [seenPage, setSeenPage] = useState(page);
  if (seenPage !== page) {
    setSeenPage(page);
    setTyped(String(page));
  }

  const first = rows === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + rows;
  const pages = total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize));

  const commit = () => {
    if (!onPage) return;
    const wanted = Number(typed);
    if (!Number.isInteger(wanted) || wanted < 1 || (pages !== undefined && wanted > pages)) {
      setTyped(String(page));
      return;
    }
    onPage(wanted);
  };

  return (
    <div className={cn("border-xms-line flex items-center justify-center gap-[6px] border-t px-4 py-[7px]", className)}>
      <button type="button" aria-label="First page" onClick={onFirst} disabled={!hasPrevious} className={STEP}>
        <ChevronFirstIcon size={ICON.control} />
      </button>
      <button type="button" aria-label="Previous page" onClick={onPrevious} disabled={!hasPrevious} className={STEP}>
        <ChevronLeftIcon size={ICON.control} />
      </button>

      <input
        aria-label="Page"
        value={typed}
        readOnly={!onPage}
        title={onPage ? undefined : "This list is read a page at a time, so it cannot jump to one."}
        onChange={(event) => setTyped(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className="xms-field border-xms-control-line text-xms-ink h-[26px] w-[52px] rounded-[4px] border text-center text-[14px] tabular-nums outline-none"
      />

      <span className="text-xms-body px-1 text-[14px] tabular-nums">
        {first} to {last}
        {total === undefined ? "" : ` of ${total.toLocaleString("en-US")}`}
      </span>

      <button type="button" aria-label="Next page" onClick={onNext} disabled={!hasNext} className={STEP}>
        <ChevronRightIcon size={ICON.control} />
      </button>
      {onLast ? (
        <button type="button" aria-label="Last page" onClick={onLast} disabled={!hasNext} className={STEP}>
          <ChevronLastIcon size={ICON.control} />
        </button>
      ) : null}
    </div>
  );
}
