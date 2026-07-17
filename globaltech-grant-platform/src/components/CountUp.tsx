"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number counting up from 0 to `value` over ~900ms with an
 * ease-out curve. Accepts the final display string already formatted
 * (e.g. "₦1,250,000" or "82%") and re-animates just the numeric portion,
 * so currency symbols/suffixes/commas stay exactly as the caller formatted
 * them — this only touches the digits.
 */
export default function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    let raf: number;
    fromRef.current = 0;
    startRef.current = null;

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(fromRef.current + (value - fromRef.current) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <>{display.toLocaleString()}</>;
}
