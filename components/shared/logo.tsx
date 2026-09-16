/**
 * BidaBeat Logo component.
 * Reusable across the application.
 */

import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = "md", className = "" }) => {
  const sizes = {
    sm: "text-lg font-bold",
    md: "text-2xl font-bold",
    lg: "text-4xl font-bold",
  };

  return (
    <div className={`${sizes[size]} ${className}`}>
      <span className="text-black dark:text-white">Bida</span>
      <span className="text-purple-600 dark:text-purple-400">Beat</span>
    </div>
  );
};
