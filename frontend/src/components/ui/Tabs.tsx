/**
 * Tab bar component for switching between content panels.
 */

import { useCallback, useRef, type KeyboardEvent } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
}

export function Tabs({ tabs, activeKey, onChange, size = "sm" }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleClick = useCallback(
    (key: string) => () => onChange(key),
    [onChange]
  );

  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    onChange(next.key);
    tabRefs.current[nextIndex]?.focus();
  }, [onChange, tabs]);

  return (
    <div className="flex overflow-x-auto border-b border-border" role="tablist" aria-label="Result views">
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          ref={(element) => { tabRefs.current[index] = element; }}
          type="button"
          role="tab"
          aria-selected={activeKey === tab.key}
          tabIndex={activeKey === tab.key ? 0 : -1}
          onClick={handleClick(tab.key)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`
            px-3 py-2 ${textSize} font-medium transition-colors
            border-b-2 -mb-px
            ${
              activeKey === tab.key
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
