import { useState, useSyncExternalStore } from 'react';
import { todayIso } from '../../shared/date.js';

export function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

/** Today's date in the visitor's own timezone. */
export function localToday(now = new Date()): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  return todayIso(now, zone);
}

export function downloadFile(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

// ---------------------------------------------------------------------------
// Hash routing: #/ (home), #/plan/<id>/<tab>
// ---------------------------------------------------------------------------

export type Route = { name: 'home' } | { name: 'plan'; id: string; tab: string | undefined };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'plan' && parts[1]) return { name: 'plan', id: parts[1], tab: parts[2] };
  return { name: 'home' };
}

export function routeHref(route: Route): string {
  if (route.name === 'home') return '#/';
  return `#/plan/${encodeURIComponent(route.id)}${route.tab ? `/${encodeURIComponent(route.tab)}` : ''}`;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return parseRoute(hash);
}

export function navigate(route: Route, { replace = false } = {}): void {
  const href = routeHref(route);
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ---------------------------------------------------------------------------
// Theme (light / dark), respecting the OS preference until the user chooses.
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark';
const THEME_KEY = 'utsav:theme';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * CSS follows the OS preference on its own; only an explicit toggle is
 * persisted, so users who never choose keep tracking their system setting.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };
  return [theme, toggle];
}
