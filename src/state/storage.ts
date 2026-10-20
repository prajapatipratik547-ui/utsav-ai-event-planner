import type { PlansState } from './reducer.js';
import type { SavedPlan } from './types.js';

export const STORAGE_KEY = 'utsav:plans:v1';

function isSavedPlan(value: unknown): value is SavedPlan {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SavedPlan>;
  return (
    typeof v.id === 'string' &&
    typeof v.createdAt === 'string' &&
    v.plan?.version === 1 &&
    typeof v.plan.input?.title === 'string' &&
    Array.isArray(v.plan.timeline) &&
    typeof v.progress === 'object' &&
    v.progress !== null &&
    Array.isArray(v.progress.guests)
  );
}

/**
 * Plans live only in this browser (no account, no server storage), which keeps
 * personal guest lists private. Corrupt or foreign data is ignored, never thrown.
 */
export function loadPlans(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): PlansState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedPlan) : [];
  } catch {
    return [];
  }
}

export function savePlans(
  plans: PlansState,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(plans));
    return true;
  } catch {
    return false; // Quota exceeded or storage disabled (private mode).
  }
}
