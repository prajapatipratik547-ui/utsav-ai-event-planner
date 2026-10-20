import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon: IconName;
  count?: number;
}

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

/**
 * WAI-ARIA tabs with automatic activation: arrow keys, Home and End move
 * between tabs; only the active tab is in the Tab order (roving tabindex).
 */
export function Tabs<T extends string>({ label, tabs, active, onChange, children }: TabsProps<T>) {
  const refs = useRef<Map<T, HTMLButtonElement>>(new Map());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((t) => t.id === active);
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[next]!;
    onChange(tab.id);
    refs.current.get(tab.id)?.focus();
  };

  return (
    <>
      <div className="tabs">
        <div className="container">
          <div className="tablist" role="tablist" aria-label={label}>
            {tabs.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    if (node) refs.current.set(tab.id, node);
                    else refs.current.delete(tab.id);
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  className="tab"
                  onClick={() => onChange(tab.id)}
                  onKeyDown={onKeyDown}
                >
                  <Icon name={tab.icon} />
                  {tab.label}
                  {tab.count !== undefined && <span className="count">{tab.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="container tabpanel fade-in"
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        key={active}
      >
        {children}
      </div>
    </>
  );
}
