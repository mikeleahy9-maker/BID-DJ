/**
 * Generic Pagination component.
 * Reusable UI component with no BidaBeat business logic.
 * Styled with design tokens from globals.css.
 */

"use client";

import React from "react";

type PageItem = number | "ellipsis";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Optional "1–10 of 42" caption; hidden when omitted. */
  total?: number;
  /** Items per page, used to compute the caption. Defaults to 10. */
  pageSize?: number;
}

/** Collapses large page ranges to first/last plus a window around `page`. */
function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const candidates = [1, 2, page - 1, page, page + 1, pageCount - 1, pageCount];
  const pages = [...new Set(candidates)]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  let previous = 0;
  for (const p of pages) {
    if (p - previous > 1) items.push("ellipsis");
    items.push(p);
    previous = p;
  }
  return items;
}

const navButtonClasses = [
  "rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition",
  "border-edge bg-surface text-muted",
  "hover:border-neon hover:text-neon",
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-edge disabled:hover:text-muted",
].join(" ");

export function Pagination({ page, pageCount, onChange, total, pageSize = 10 }: PaginationProps) {
  if (pageCount <= 1 && !total) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total ?? pageCount * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-2 pt-3"
    >
      {total !== undefined ? (
        <span className="mr-2 text-xs text-muted">
          Showing {from}–{to} of {total}
        </span>
      ) : null}
      <button
        type="button"
        className={navButtonClasses}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pageItems(page, pageCount).map((item, i) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Page ${item}`}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
              item === page
                ? "border-neon bg-neon text-bg"
                : "border-edge bg-surface text-muted hover:border-neon hover:text-neon"
            }`}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        className={navButtonClasses}
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}

export default Pagination;