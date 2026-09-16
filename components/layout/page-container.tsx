/**
 * PageContainer component.
 * Wrapper for page content with consistent max-width and padding.
 */

import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`container mx-auto max-w-7xl px-4 py-8 ${className}`}>
      {children}
    </div>
  );
};
