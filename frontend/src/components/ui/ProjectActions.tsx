/**
 * Local save/project-library/export actions with Ctrl+S / Ctrl+O shortcuts.
 *
 * Works in both Simulator and Editor modes — the parent page provides
 * a callback for capturing the current project state. Import and migration
 * review live on the Projects page.
 */

import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { downloadProject } from "../../utils/project-file";
import type { ProjectFile } from "../../utils/project-file";
import { useProjectSession } from "../../features/project-management/ProjectSessionProvider";

interface ProjectActionsProps {
  /** Create a ProjectFile from current page state */
  onSave: () => ProjectFile;
  /** Legacy page restore callback retained while import is routed through Projects. */
  onLoad?: (project: ProjectFile) => void;
  /** Optional: additional class names for the wrapper */
  className?: string;
}

export function ProjectActions({ onSave, className = "" }: ProjectActionsProps) {
  const navigate = useNavigate();
  const session = useProjectSession();

  const handleSave = useCallback(() => {
    const model = onSave();
    if (!session.current || session.current.project.mode !== model.mode) {
      navigate("/projects");
      return;
    }
    try {
      session.save();
    } catch {
      navigate("/projects");
    }
  }, [navigate, onSave, session]);

  const handleOpenClick = useCallback(() => {
    navigate("/projects");
  }, [navigate]);

  const handleExport = useCallback(() => {
    downloadProject(onSave());
  }, [onSave]);

  // Keyboard shortcuts: Ctrl+S to save, Ctrl+O to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        handleOpenClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleOpenClick]);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        onClick={handleSave}
        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-secondary bg-surface border border-border rounded hover:border-accent/50 hover:text-text-primary transition-colors"
        title="Save project (Ctrl+S)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        Save
      </button>
      <button
        onClick={handleOpenClick}
        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-secondary bg-surface border border-border rounded hover:border-accent/50 hover:text-text-primary transition-colors"
        title="Open local projects (Ctrl+O)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        Projects
      </button>
      <button
        onClick={handleExport}
        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-secondary bg-surface border border-border rounded hover:border-accent/50 hover:text-text-primary transition-colors"
        title="Export portable .hfas file"
      >
        Export
      </button>
    </div>
  );
}
