import { useId, useState, type ReactNode } from "react";

interface InspectorSectionProps {
  title: string;
  eyebrow?: string;
  help?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function InspectorSection({ title, eyebrow, help, defaultOpen = true, children }: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className="border-b border-border/80">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`text-text-secondary transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">›</span>
        <span className="min-w-0 flex-1">
          {eyebrow && <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</span>}
          <span className="block text-xs font-semibold text-text-primary">{title}</span>
        </span>
        {help && <span className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] text-text-secondary" title={help} aria-label={help}>?</span>}
      </button>
      {open && <div id={contentId} className="space-y-4 px-4 pb-4">{children}</div>}
    </section>
  );
}
