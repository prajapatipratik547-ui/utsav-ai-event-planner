import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { plansReducer, type PlanAction, type PlansState } from './reducer.js';
import { loadPlans, savePlans } from './storage.js';

interface PlansContextValue {
  plans: PlansState;
  dispatch: (action: PlanAction) => void;
  /** False when the browser refused to persist (private mode / quota). */
  persisted: boolean;
}

const PlansContext = createContext<PlansContextValue | null>(null);

export function PlansProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: PlansState;
}) {
  const [plans, dispatch] = useReducer(plansReducer, initial, (seed) => seed ?? loadPlans());
  const [persisted, setPersisted] = useState(true);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Debounce writes so typing in a notes field doesn't serialise on every keystroke.
    const handle = window.setTimeout(() => setPersisted(savePlans(plans)), 250);
    return () => window.clearTimeout(handle);
  }, [plans]);

  const value = useMemo(() => ({ plans, dispatch, persisted }), [plans, persisted]);
  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export function usePlans(): PlansContextValue {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used inside <PlansProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Screen-reader announcements
// ---------------------------------------------------------------------------

const AnnounceContext = createContext<(message: string) => void>(() => {});

/** A single polite live region for status messages (saved, deleted, exported…). */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((next: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(next), 50);
  }, []);
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

export const useAnnounce = () => useContext(AnnounceContext);
