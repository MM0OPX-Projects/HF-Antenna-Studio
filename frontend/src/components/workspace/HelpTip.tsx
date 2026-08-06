interface HelpTipProps {
  label: string;
  children: string;
}

export function HelpTip({ label, children }: HelpTipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] font-bold text-text-secondary hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ?
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-7 z-50 hidden w-64 rounded-lg border border-border bg-surface-elevated p-3 text-left text-xs font-normal leading-5 text-text-primary shadow-2xl group-hover:block group-focus-within:block">
        {children}
      </span>
    </span>
  );
}
