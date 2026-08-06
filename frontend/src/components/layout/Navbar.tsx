/**
 * Top navigation bar — logo, nav links, theme toggle, unit toggle.
 *
 * Mobile: hamburger menu toggles a dropdown panel with all nav links.
 * Desktop: links shown inline in the header.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUIStore } from "../../stores/uiStore";

/** Shared nav link definitions */
const NAV_LINKS = [
  { to: "/", label: "Simulator", featured: false },
  { to: "/editor", label: "Wire Editor", featured: true },
  { to: "/frequency-analyser", label: "Analyser", featured: true },
  { to: "/model-comparison", label: "Compare", featured: true },
  { to: "/parameter-sweeps", label: "Sweeps", featured: true },
  { to: "/antenna-optimiser", label: "Optimiser", featured: true },
  { to: "/measurement-comparison", label: "Measured", featured: true },
  { to: "/projects", label: "Projects", featured: false },
  { to: "/verified-dipole", label: "Verified Dipole", featured: false },
  { to: "/dipole-height-lab", label: "Height Lab", featured: false },
  { to: "/antenna-templates", label: "Templates", featured: false },
  { to: "/vertical-antennas", label: "Verticals", featured: false },
  { to: "/yagi-beams", label: "Yagi Beams", featured: false },
  { to: "/loop-and-hexbeam-models", label: "Loops & Hex", featured: false },
  { to: "/phased-arrays", label: "Phased Arrays", featured: false },
  { to: "/library", label: "Library", featured: false },
  { to: "/learn", label: "Learn", featured: false },
  { to: "/about", label: "About", featured: false },
] as const;

const PRIMARY_LINKS = [
  { to: "/", label: "Design" },
  { to: "/editor", label: "Wire Editor" },
  { to: "/frequency-analyser", label: "Analyse" },
  { to: "/model-comparison", label: "Compare" },
  { to: "/projects", label: "Projects" },
] as const;

const MODULE_LINKS = NAV_LINKS.filter(({ to }) => !PRIMARY_LINKS.some((primary) => primary.to === to));

export function Navbar() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const imperial = useUIStore((s) => s.imperial);
  const toggleUnits = useUIStore((s) => s.toggleUnits);
  const openChangelog = useUIStore((s) => s.openChangelog);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const location = useLocation();

  const handleUnitToggle = useCallback(() => {
    toggleUnits();
  }, [toggleUnits]);

  // Mobile menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const modulesRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click (ignore clicks on the toggle button itself —
  // those are handled by the button's onClick which toggles the state)
  useEffect(() => {
    if (!menuOpen && !modulesOpen) return;
    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        (!menuRef.current || !menuRef.current.contains(target)) &&
        (!toggleRef.current || !toggleRef.current.contains(target)) &&
        (!modulesRef.current || !modulesRef.current.contains(target))
      ) {
        setMenuOpen(false);
        setModulesOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [menuOpen, modulesOpen]);

  function linkClass(path: string): string {
    const active = location.pathname === path;
    return `rounded-md px-2.5 py-1.5 font-medium transition-colors ${active ? "bg-accent/12 text-accent" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"}`;
  }

  return (
    <header className="relative shrink-0">
      <div className="flex h-12 items-center justify-between border-b border-border bg-surface/95 px-3 shadow-sm backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-5">
          {/* Logo */}
          <Link to="/" className="flex min-w-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 17h3l2-9 4 13 3-10 2 6h4" /></svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-text-primary sm:text-base">HF Antenna Studio</span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-text-secondary sm:block">Local NEC workspace · v{__APP_VERSION__}</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-1 text-xs xl:flex" aria-label="Primary application navigation">
            {PRIMARY_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} className={linkClass(to)} aria-current={location.pathname === to ? "page" : undefined}>
                {label}
              </Link>
            ))}
            <div className="relative" ref={modulesRef}>
              <button type="button" className="rounded-md px-2.5 py-1.5 font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" aria-haspopup="menu" aria-expanded={modulesOpen} onClick={() => setModulesOpen((open) => !open)}>
                Modules <span aria-hidden="true">⌄</span>
              </button>
              {modulesOpen && (
                <div role="menu" className="absolute left-0 top-full z-50 mt-2 grid w-[34rem] grid-cols-2 gap-1 rounded-xl border border-border bg-surface-elevated p-2 shadow-2xl">
                  {MODULE_LINKS.map(({ to, label }) => (
                    <Link key={to} to={to} role="menuitem" onClick={() => setModulesOpen(false)} className="rounded-lg px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openChangelog}
            className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:bg-surface-hover hover:text-text-primary xl:inline-flex"
            title="Show the latest changelog"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2L11.5 7.1L16.5 8.5L11.5 9.9L10 15L8.5 9.9L3.5 8.5L8.5 7.1L10 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <span className="hidden lg:inline">What’s new</span>
          </button>

          {/* Unit toggle */}
          <button
            type="button"
            onClick={handleUnitToggle}
            className="px-1.5 py-0.5 rounded-md text-[11px] font-mono text-text-secondary
              hover:text-text-primary hover:bg-surface-hover transition-colors border border-border"
            title={`Switch to ${imperial ? "metric" : "imperial"} units`}
            aria-label={`Display units: ${imperial ? "imperial" : "metric"}. Switch to ${imperial ? "metric" : "imperial"}.`}
          >
            {imperial ? "Imperial" : "Metric"}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={handleThemeToggle}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary
              hover:bg-surface-hover transition-colors"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Hamburger button (mobile only) */}
          <button
            ref={toggleRef}
            onClick={() => setMenuOpen((o) => !o)}
            className="xl:hidden p-2 -mr-2 rounded-md text-text-secondary hover:text-text-primary
              hover:bg-surface-hover transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="xl:hidden absolute top-full left-0 right-0 z-50 border-b border-border bg-surface shadow-lg"
        >
          <nav className="flex flex-col py-2">
            {NAV_LINKS.map(({ to, label, featured }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-6 py-3 text-sm transition-colors ${
                  location.pathname === to
                    ? "text-accent font-medium bg-accent/5"
                    : featured
                      ? "text-accent bg-accent/5 hover:bg-accent/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                {featured && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="5" cy="18" r="2" />
                    <circle cx="12" cy="7" r="2" />
                    <circle cx="19" cy="16" r="2" />
                    <path d="M6.2 16.4l4.6-7.8M13.6 8.2l4.1 6.6" />
                  </svg>
                )}
                {label}
                {featured && (
                  <span className="ml-auto rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                    Advanced
                  </span>
                )}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openChangelog();
              }}
              className="flex cursor-pointer items-center gap-2 border-t border-border px-6 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 2L11.5 7.1L16.5 8.5L11.5 9.9L10 15L8.5 9.9L3.5 8.5L8.5 7.1L10 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              What’s new
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
