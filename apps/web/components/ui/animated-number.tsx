'use client';

import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }

    const duration = 260;
    const startTime = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      // Strong ease-out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(start + (end - start) * eased));

      if (elapsed < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
}
