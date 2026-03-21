import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(value: number, duration = 350) {
  const [animatedValue, setAnimatedValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const start = previousValue.current;
    const end = value;
    const diff = end - start;

    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setAnimatedValue(start + diff * eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        previousValue.current = end;
      }
    }

    requestAnimationFrame(tick);
  }, [value, duration]);

  return Math.round(animatedValue);
}
