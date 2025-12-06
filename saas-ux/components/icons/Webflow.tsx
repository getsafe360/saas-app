// components/icons/Webflow.tsx
/**
 * Webflow logomark
 * Uses hardcoded official Webflow blue color
 * Example: <WebflowIcon size={24} />
 *
 * Official Webflow blue: #146EF5
 */

import type { ComponentType } from "react";

export const WebflowIcon: ComponentType<{
  size?: number;
  className?: string;
}> = ({ size = 24, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 319.382"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Webflow"
    >
      <path
        fill="#146EF5"
        d="M512 0L348.627 319.382H195.172l68.375-132.364h-3.071C204.072 260.235 119.911 308.437 0 319.382V188.849s76.71-4.533 121.808-51.945H0V.007h136.897v112.594l3.071-.013L195.91.007h103.535V111.89l3.071-.006L360.557 0H512z"
      />
    </svg>
  );
};
