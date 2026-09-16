/**
 * EmptyState component.
 * Displays when there is no data to show.
 */

import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icon && <div className="mb-4 text-4xl">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold text-black dark:text-white">
        {title}
      </h3>
      <p className="mb-6 text-center text-gray-600 dark:text-gray-400">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
