/**
 * Form field primitives.
 * Styled with Tailwind utilities using theme tokens.
 */

import React from "react";

interface FieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Vertical field wrapper: label on top, input below. */
export const Field: React.FC<FieldProps> = ({
  label,
  children,
  className = "",
}) => (
  <div className={`flex flex-col gap-[5px] ${className}`}>
    <span className="text-[11px] uppercase tracking-[1px] text-muted">
      {label}
    </span>
    {children}
  </div>
);

/** Text input styled like the prototype's .form-input. */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`rounded-lg border border-edge bg-surface-2 px-[14px] py-[11px] text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon ${className}`}
    {...props}
  />
));

Input.displayName = "Input";

/** Row wrapper that lays child Fields side by side. */
export const FieldRow: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div className={`flex gap-[10px] ${className}`}>{children}</div>
);

export default Input;