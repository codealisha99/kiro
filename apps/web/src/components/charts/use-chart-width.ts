"use client";

import { useEffect, useState } from "react";

// Measures the container width so SVG charts redraw at the real size. The fallback covers the first paint.
// A callback ref, not useRef: a chart that mounts in its loading state renders the measured element later,
// and the observer must attach whenever that element appears (otherwise it stays at the fallback width).
export function useChartWidth<T extends HTMLElement>(fallback = 640) {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!element) return;
    const update = () => setWidth(Math.max(0, Math.floor(element.clientWidth)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width] as const;
}
