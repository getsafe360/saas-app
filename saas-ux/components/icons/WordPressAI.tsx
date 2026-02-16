import { useId } from "react";

interface WordPressAIIconProps {
  size?: number;
  className?: string;
}

export function WordPressAIIcon({
  size = 24,
  className = "",
}: WordPressAIIconProps) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="WordPress AI"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="8"
          y1="8"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--category-wordpress-gradient-start)" />
          <stop
            offset="1"
            stopColor="var(--category-wordpress-gradient-end)"
          />
        </linearGradient>
      </defs>

      <circle cx="24" cy="24" r="16" stroke={`url(#${gradientId})`} strokeWidth="2" />

      <circle cx="24" cy="6" r="2" fill={`url(#${gradientId})`} />
      <circle cx="24" cy="42" r="2" fill={`url(#${gradientId})`} />
      <circle cx="6" cy="24" r="2" fill={`url(#${gradientId})`} />
      <circle cx="42" cy="24" r="2" fill={`url(#${gradientId})`} />
      <circle cx="11" cy="11" r="2" fill={`url(#${gradientId})`} />
      <circle cx="37" cy="11" r="2" fill={`url(#${gradientId})`} />
      <circle cx="11" cy="37" r="2" fill={`url(#${gradientId})`} />
      <circle cx="37" cy="37" r="2" fill={`url(#${gradientId})`} />

      <circle cx="24" cy="24" r="10" stroke={`url(#${gradientId})`} strokeWidth="2" />

      <path
        d="M18.5 19.5L20.5 29L22.75 22.5L24.75 29L27 19.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
