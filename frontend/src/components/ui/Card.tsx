/**
 * Card component for grouping related content.
 */

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  children: ReactNode;
  className?: string;
  /** Optional click handler (makes card interactive) */
  onClick?: () => void;
  /** Highlight border when selected */
  selected?: boolean;
}

export function Card({
  children,
  className = "",
  onClick,
  selected = false,
  ...props
}: CardProps) {
  const interactive = !!onClick;

  return (
    <div
      {...props}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`
        rounded-lg border bg-surface
        ${selected ? "border-accent shadow-sm shadow-accent/10" : "border-border"}
        ${interactive ? "cursor-pointer hover:bg-surface-hover hover:border-accent/50 transition-colors" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
