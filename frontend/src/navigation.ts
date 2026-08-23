export const APP_NAV_LINKS = [
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

export const PRIMARY_NAV_LINKS = [
  { to: "/", label: "Design" },
  { to: "/editor", label: "Wire Editor" },
  { to: "/frequency-analyser", label: "Analyse" },
  { to: "/model-comparison", label: "Compare" },
  { to: "/projects", label: "Projects" },
] as const;

export const MODULE_NAV_LINKS = APP_NAV_LINKS.filter(
  ({ to }) => !PRIMARY_NAV_LINKS.some((primary) => primary.to === to),
);
