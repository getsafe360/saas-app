// components/icons/Joomla.tsx
/**
 * Joomla logomark
 * Multi-colored official logo with brand colors
 * Example: <JoomlaIcon size={24} />
 *
 * Official Joomla colors:
 * - Blue: #5091CD
 * - Red: #F44321
 * - Orange: #F9A541
 * - Green: #7AC143
 */

import type { ComponentType } from "react";

export const JoomlaIcon: ComponentType<{
  size?: number;
  className?: string;
}> = ({ size = 24, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 333333 333333"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Joomla"
    >
      {/* Blue piece - Bottom left */}
      <path
        fill="#5091CD"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M199328 172100l-74054 74198c-10648 10667-28002 10685-38730-37-10685-10711-10685-28027-24-38730l2541-2521-32899-32911-2516 2504c-19126 19149-25584 46161-19352 70619C14621 249866 0 267552 0 288676c0 24667 19962 44641 44586 44641 21187-26 38932-14795 43480-34622 24311 6041 51096-417 70097-19456l74052-74200-32873-32960-12 18-2 4z"
      />

      {/* Red piece - Top right */}
      <path
        fill="#F44321"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M294983 244465c5900-24230-646-50899-19557-69831l-74064-74194-32911 32911 74060 74219c10734 10746 10711 28021 67 38681-10685 10685-28002 10685-38688 0l-2516-2541-32876 32960 2516 2522c20023 20037 48708 26187 74022 18387 4106 20399 22106 35754 43710 35754 24606 0 44586-19980 44586-44649 0-22521-16671-41161-38330-44206l-20-12z"
      />

      {/* Orange piece - Top left */}
      <path
        fill="#F9A541"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M332902 44645C332902 19976 312945 2 288322 2c-22539 0-41159 16744-44163 38478-25086-7382-53316-1152-73123 18683l-74158 74188 32911 32935 74145-74162c10728-10734 27995-10711 38619-61 10667 10685 10667 28039-24 38730l-2541 2541 32868 32960 2559-2583c19685-19704 25941-47767 18750-72792 21850-2872 38706-21604 38706-44267l31-6z"
      />

      {/* Green piece - Bottom left */}
      <path
        fill="#7AC143"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M86581 90061c10685-10685 27996-10685 38669 0l2541 2559 32911-32935-2559-2559c-18744-18799-45084-25358-69144-19710C85542 16212 67167 3 44998 3 20378 1 418 20001 418 44644c0 21265 14837 39062 34732 43558-7541 25202-1378 53667 18504 73554l74163 74182 32875-32934-74164-74182c-10647-10649-10667-28039 61-38773l-6 12z"
      />
    </svg>
  );
};
