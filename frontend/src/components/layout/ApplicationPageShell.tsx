import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface ApplicationPageShellProps {
  children: ReactNode;
}

/**
 * Navigation boundary for full-page tools which do not render their own
 * workspace header. Keeping this at the route boundary prevents a tool from
 * becoming a dead end inside the chromeless Windows application window.
 */
export function ApplicationPageShell({ children }: ApplicationPageShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-background text-text-primary">
      <Navbar />
      {children}
    </div>
  );
}
