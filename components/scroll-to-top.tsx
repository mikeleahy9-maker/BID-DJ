"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Always start a page from the top on navigation.
 *
 * The browser otherwise keeps/restores the previous scroll offset, which made
 * DJ pages open partway down so the top section was off-screen. This resets the
 * scroll on every route change.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default ScrollToTop;
