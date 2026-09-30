"use client";

import { useEffect, useRef, useState } from "react";
import { searchDeezerSongs } from "./deezer";
import type { SeedSong } from "@/features/dj/data";

export function useInfiniteSongSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SeedSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextIndex, setNextIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef("");

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery("");
    setResults([]);
    setSearching(false);
    setLoadingMore(false);
    setHasMore(false);
    setNextIndex(0);
    queryRef.current = "";
  };

  const doSearch = async (q: string) => {
    queryRef.current = q;
    setSearching(true);
    setLoadingMore(false);
    setHasMore(false);
    const res = await searchDeezerSongs(q, 0);
    if (queryRef.current !== q) return;
    setResults(res.tracks);
    setNextIndex(res.nextIndex);
    setHasMore(res.hasMore);
    setSearching(false);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    const q = value.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) {
      reset();
      setQuery(value);
      return;
    }
    timerRef.current = setTimeout(async () => {
      await doSearch(q);
    }, 700);
  };

  const loadMore = async () => {
    if (searching || loadingMore || !hasMore) return;
    const q = query.trim();
    if (q.length < 2) return;
    setLoadingMore(true);
    const res = await searchDeezerSongs(q, nextIndex);
    if (queryRef.current !== q) return;
    setResults((prev) => {
      const seen = new Set(prev.map((s) => s.deezerId));
      const fresh = res.tracks.filter((s) => !seen.has(s.deezerId));
      return [...prev, ...fresh];
    });
    setNextIndex(res.nextIndex);
    setHasMore(res.hasMore);
    setLoadingMore(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    query,
    results,
    searching,
    loadingMore,
    hasMore,
    handleSearch,
    loadMore,
    reset,
  };
}