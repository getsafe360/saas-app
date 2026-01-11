// components/onboarding/Confetti.tsx
"use client";

import { useEffect, useState } from "react";
import ReactConfetti from "react-confetti";

interface ConfettiProps {
  /**
   * Duration in milliseconds (default: 5000ms = 5 seconds)
   */
  duration?: number;

  /**
   * Number of confetti pieces (default: 200)
   */
  numberOfPieces?: number;

  /**
   * Callback when confetti animation completes
   */
  onComplete?: () => void;
}

/**
 * Confetti celebration component
 * Shows confetti animation for a specified duration
 */
export function Confetti({
  duration = 5000,
  numberOfPieces = 200,
  onComplete,
}: ConfettiProps) {
  const [isActive, setIsActive] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Get window dimensions
  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Auto-stop after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsActive(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isActive || windowSize.width === 0) {
    return null;
  }

  return (
    <ReactConfetti
      width={windowSize.width}
      height={windowSize.height}
      numberOfPieces={numberOfPieces}
      recycle={false}
      gravity={0.3}
      colors={["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"]}
    />
  );
}
