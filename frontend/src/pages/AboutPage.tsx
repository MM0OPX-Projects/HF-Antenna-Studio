/**
 * About page — project info, credits, and links.
 */

import { useEffect, useState } from "react";
import { Navbar } from "../components/layout/Navbar";
import { getRuntimeInfo, openLogDirectory, type DesktopRuntimeInfo } from "../platform/desktop-runtime";

const FEATURES = [
  {
    title: "NEC2 Engine",
    description:
      "Uses the repository's pinned nec2c/WebAssembly NEC-2 build. Validation scope and known limitations are published with the project.",
  },
  {
    title: "Parametric antenna workflows",
    description:
      "Dipoles, verticals, loops, Yagis, phased arrays, and other templates share adjustable parameters and an interactive 3D preview.",
  },
  {
    title: "3D Visualization",
    description:
      "Interactive 3D antenna rendering with radiation pattern surfaces, current distribution, volumetric shells, and ground reflections.",
  },
  {
    title: "Wire Editor",
    description:
      "Full-featured wire editor with undo/redo, snap grid, loads, transmission lines, and .nec/.maa import/export.",
  },
  {
    title: "Engineering exploration",
    description:
      "Comparison, measurement, sweep, and bounded best-solution tools retain exact NEC model evidence and limitations.",
  },
  {
    title: "Local and private",
    description:
      "The Windows package contains the interface and verified nec2c/WebAssembly engine. Normal calculations require no account or network connection.",
  },
];

const LINKS = [
  {
    label: "NEC2 Documentation (original)",
    url: "https://www.nec2.org/",
  },
  {
    label: "nec2c (C translation of NEC2)",
    url: "https://github.com/tmolteno/nec2c",
  },
  {
    label: "ARRL Antenna Book",
    url: "https://www.arrl.org/arrl-antenna-book",
  },
  {
    label: "L.B. Cebik Antenna Models (archive)",
    url: "https://www.cebik.com/",
  },
];

export function AboutPage() {
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    void getRuntimeInfo().then(setRuntime).catch((error: unknown) => {
      setLogError(error instanceof Error ? error.message : "Runtime information is unavailable.");
    });
  }, []);

  async function showLogs() {
    setLogError(null);
    try {
      await openLogDirectory();
    } catch (error) {
      setLogError(error instanceof Error ? error.message : "The log directory could not be opened.");
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Navbar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
          {/* Hero */}
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              About HF Antenna Studio
            </h1>
            <p className="text-text-secondary leading-relaxed">
              HF Antenna Studio is a free, open-source, locally operated antenna
              modelling workspace built around a pinned NEC-2 calculation engine.
              It provides an original interface and does not copy commercial
              application source, artwork, or layouts.
            </p>
          </div>

          <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="runtime-heading">
            <h2 id="runtime-heading" className="text-lg font-semibold text-text-primary">Installed runtime</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-text-secondary">Version</dt><dd className="font-mono text-text-primary" data-testid="about-version">{runtime?.version ?? __APP_VERSION__}</dd></div>
              <div><dt className="text-text-secondary">Mode</dt><dd className="text-text-primary" data-testid="about-runtime-mode">{runtime?.packaged ? "Installed Windows application" : "Browser development application"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-text-secondary">Project storage</dt><dd className="text-text-primary">{runtime?.projectStorage ?? "Loading runtime information…"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-text-secondary">Troubleshooting logs</dt><dd className="break-all font-mono text-xs text-text-primary" data-testid="about-log-directory">{runtime?.logDirectory ?? "Loading…"}</dd></div>
            </dl>
            {runtime?.packaged && <button type="button" onClick={() => void showLogs()} className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-text-primary hover:border-accent/50">Open log folder</button>}
            {logError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{logError}</p>}
          </section>

          {/* Features */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Features
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="p-4 bg-surface border border-border rounded-lg"
                >
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    {f.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3">
              How It Works
            </h2>
            <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
              <p>
                HF Antenna Studio uses the <strong className="text-text-primary">Method of Moments (MoM)</strong> via
                the NEC2 engine to solve Maxwell's equations for thin-wire structures.
                Your antenna geometry is broken into segments, and NEC2 computes the
                current distribution, impedance, radiation pattern, and other parameters.
              </p>
              <p>
                In the supported Windows package, simulation runs through the bundled
                <code className="mx-1 rounded bg-background px-1 py-0.5 font-mono text-xs">nec2c/WebAssembly</code>
                build inside a dedicated worker. Parameters, project data, generated
                NEC decks, and results remain on this computer during normal use.
              </p>
              <p>
                The 3D visualization is powered by <strong className="text-text-primary">Three.js</strong> via
                React Three Fiber, with PBR materials, bloom effects, and interactive
                camera controls.
              </p>
            </div>
          </div>

          {/* Links */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3">
              Resources
            </h2>
            <ul className="space-y-2">
              {LINKS.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Stack */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3">
              Tech Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                "React 19",
                "TypeScript",
                "Three.js / R3F",
                "Tailwind CSS",
                "Zustand",
                "Recharts",
                "Tauri 2",
                "WebView2",
                "WebAssembly",
                "nec2c",
              ].map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 text-xs font-mono bg-surface border border-border rounded-md text-text-secondary"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border pt-6 pb-4">
            <p className="text-xs text-text-secondary">
              HF Antenna Studio v{__APP_VERSION__} · GPL-3.0-or-later · bundled nec2c/WebAssembly NEC-2 engine
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Made for amateur radio operators who deserve modern tools. 73!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
