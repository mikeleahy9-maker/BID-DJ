"use client";

import { useEffect, useRef } from "react";

export function InfiniteScrollLoader({
  onLoadMore,
  loading,
  hasMore,
}: {
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, loading, hasMore]);

  if (!hasMore) return null;

  return (
    <div
      ref={ref}
      className="flex items-center justify-center gap-2 py-3 text-xs text-muted"
      aria-live="polite"
    >
      {loading && (
        <>
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-edge border-t-neon" />
          Loading more…
        </>
      )}
    </div>
  );
}