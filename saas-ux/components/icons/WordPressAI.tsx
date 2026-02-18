import { useId } from "react";

interface WordPressAIIconProps {
  size?: number;
  className?: string;
}

export function WordPressAIIcon({
  size = 24,
  className = "",
}: WordPressAIIconProps) {
  const gradientId = useId().replace(/:/g, "");
  const wpGradientId = `wpai-gradient-${gradientId}`;
  const startColor = "var(--category-wordpress-gradient-start, #3b82f6)";
  const endColor = "var(--category-wordpress-gradient-end, #22d3ee)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block" }}
      role="img"
      aria-label="WordPress AI"
    >
      <defs>
        <linearGradient
          id={wpGradientId}
          x1="8"
          y1="8"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={startColor} />
          <stop offset="1" stopColor={endColor} />
        </linearGradient>
      </defs>

      <circle cx="24" cy="24" r="19" stroke={`url(#${wpGradientId})`} strokeWidth="2.2" />
      <circle cx="24" cy="24" r="13" stroke={`url(#${wpGradientId})`} strokeWidth="1.8" opacity="0.7" />

      <circle cx="24" cy="4.5" r="2" fill={`url(#${wpGradientId})`} />
      <circle cx="24" cy="43.5" r="2" fill={`url(#${wpGradientId})`} />
      <circle cx="4.5" cy="24" r="2" fill={`url(#${wpGradientId})`} />
      <circle cx="43.5" cy="24" r="2" fill={`url(#${wpGradientId})`} />
      <circle cx="10.2" cy="10.2" r="1.8" fill={`url(#${wpGradientId})`} />
      <circle cx="37.8" cy="10.2" r="1.8" fill={`url(#${wpGradientId})`} />
      <circle cx="10.2" cy="37.8" r="1.8" fill={`url(#${wpGradientId})`} />
      <circle cx="37.8" cy="37.8" r="1.8" fill={`url(#${wpGradientId})`} />

      <path
        d="M16.8 16.8h3l4.2 13.2 2.2-7.3c.5-1.7 1.5-3.7 1.5-5.1 0-.6-.1-1.2-.3-1.7h3.8"
        stroke={`url(#${wpGradientId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
