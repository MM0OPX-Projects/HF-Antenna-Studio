export const MODULE_PROJECT_CATALOG = {
  "verified-dipole": { route: "/verified-dipole", label: "Verified Dipole" },
  "dipole-height-lab": { route: "/dipole-height-lab", label: "Dipole Height Lab" },
  "antenna-templates": { route: "/antenna-templates", label: "Antenna Template Studio" },
  "vertical-antennas": { route: "/vertical-antennas", label: "Vertical Antennas" },
  "yagi-beams": { route: "/yagi-beams", label: "Yagi Beams" },
  "loop-beams": { route: "/loop-and-hexbeam-models", label: "Loops & Hexbeam" },
  "phased-arrays": { route: "/phased-arrays", label: "Phased Arrays" },
  "frequency-analyser": { route: "/frequency-analyser", label: "Frequency Analyser" },
  "measurement-comparison": { route: "/measurement-comparison", label: "Measurement Comparison" },
} as const;

export type ModuleProjectId = keyof typeof MODULE_PROJECT_CATALOG;

export function moduleProjectDefinition(moduleId: string): { route: string; label: string } | null {
  return Object.prototype.hasOwnProperty.call(MODULE_PROJECT_CATALOG, moduleId)
    ? MODULE_PROJECT_CATALOG[moduleId as ModuleProjectId]
    : null;
}
