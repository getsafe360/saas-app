// components/icons/Magento.tsx
/**
 * Magento logomark
 * Uses hardcoded official Magento orange color
 * Example: <MagentoIcon size={24} />
 *
 * Official Magento orange: #F26322
 */

import type { ComponentType } from "react";

export const MagentoIcon: ComponentType<{
  size?: number;
  className?: string;
}> = ({ size = 24, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1129.16 1333.33"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Magento"
    >
      <path
        fill="#F26322"
        fillRule="nonzero"
        d="M638.91 399.93v759.5l-74.69 45.65-74.75-45.89V400.52L295.93 519.68v649.51l268.28 164.15 270.55-165.32V519.27L638.89 399.94zM564.22 0L0 341.84v649.59l146.54 86.33V428.11l417.8-254.04 418.19 253.67 1.72.98-.19 648.07 145.1-85.36V341.84L564.23 0z"
      />
    </svg>
  );
};
