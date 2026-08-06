/**
 * Segmented control for mobile tab switching.
 */

import { useCallback, useRef, type KeyboardEvent } from "react";

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function SegmentedControl({
  segments,
  activeKey,
  onChange,
}: SegmentedControlProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleClick = useCallback(
    (key: string) => () => onChange(key),
    [onChange]
  );

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % segments.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + segments.length) % segments.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = segments.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = segments[nextIndex];
    if (!next) return;
    onChange(next.key);
    tabRefs.current[nextIndex]?.focus();
  }, [onChange, segments]);

  return (
    <div className="flex bg-background rounded-lg p-0.5 border border-border" role="tablist" aria-label="Workspace panel">
      {segments.map((seg, index) => (
        <button
          key={seg.key}
          ref={(element) => { tabRefs.current[index] = element; }}
          type="button"
          role="tab"
          aria-selected={activeKey === seg.key}
          tabIndex={activeKey === seg.key ? 0 : -1}
          onClick={handleClick(seg.key)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`
            flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors
            ${
              activeKey === seg.key
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }
          `}
        >
          {seg.label}
        </button>
      ))}
    </div>
  );
}
