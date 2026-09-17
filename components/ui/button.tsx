/**
 * Generic Button component.
 * Reusable UI component with no BidaBeat business logic.
 * Styled with design tokens from globals.css.
 */

import React from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const baseStyles = [
  "inline-flex items-center justify-center gap-2 rounded-lg",
  "font-medium transition-colors select-none",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-neon text-bg hover:opacity-90 shadow-[0_0_20px_rgba(0,255,225,0.2)]",
  secondary:
    "bg-surface-2 text-foreground border border-edge hover:border-neon hover:text-neon",
  outline: "border border-neon text-neon hover:bg-white/5",
  ghost: "text-muted hover:text-foreground",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
    ref
  ) => (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ""}`}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  )
);

Button.displayName = "Button";

export default Button;