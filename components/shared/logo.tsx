/**
 * BidaBeat Logo component.
 * Renders the "BID ·A· BEAT" wordmark in stacked (landing) or inline
 * (auth/topbar) variants using theme-token utilities.
 */

import React from "react";

type LogoLayout = "stack" | "inline";
type LogoSize = "sm" | "md";

interface LogoProps {
  layout?: LogoLayout;
  size?: LogoSize;
  className?: string;
}

const inlineSizes: Record<LogoSize, string> = {
  sm: "text-[22px] tracking-[2px]",
  md: "text-[36px] tracking-[3px]",
};

export const Logo: React.FC<LogoProps> = ({
  layout = "inline",
  size = "md",
  className = "",
}) => {
  if (layout === "stack") {
    return (
      <div className={`text-center font-display leading-none ${className}`}>
        <span className="block text-[52px] tracking-[6px] text-neon">BID</span>
        <span className="block -my-[6px] text-[28px] tracking-[12px] text-white/40">
          · A ·
        </span>
        <span className="block bg-gradient-to-br from-neon-2 to-[#ff8800] bg-clip-text text-[72px] tracking-[2px] text-transparent">
          BEAT
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-baseline gap-[3px] font-display leading-none ${inlineSizes[size]} ${className}`}
      aria-label="BidaBeat"
    >
      <span className="text-neon">BID</span>
      <span className="text-[0.5em] tracking-[2px] text-white/30">·A·</span>
      <span className="bg-gradient-to-br from-neon-2 to-[#ff8800] bg-clip-text text-transparent">
        BEAT
      </span>
    </div>
  );
};

export default Logo;