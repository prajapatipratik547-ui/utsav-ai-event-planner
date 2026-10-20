import type { BudgetCategory } from '../../shared/constants.js';
import type { EventPlan, Milestone } from '../../shared/types.js';
import {
  emptyProgress,
  type ChatEntry,
  type Guest,
  type PlanProgress,
  type SavedPlan,
  type VendorStatus,
} from './types.js';

export type PlansState = SavedPlan[];

export type PlanAction =
  | { type: 'plan/add'; id: string; plan: EventPlan; at: string }
  | { type: 'plan/replace'; id: string; plan: EventPlan; at: string }
  | { type: 'plan/remove'; id: string }
  | { type: 'milestone/toggle'; id: string; milestoneId: string }
  | { type: 'milestone/add'; id: string; milestone: Milestone }
  | { type: 'milestone/remove'; id: string; milestoneId: string }
  | { type: 'vendor/status'; id: string; vendorId: string; status: VendorStatus }
  | { type: 'vendor/notes'; id: string; vendorId: string; notes: string }
  | { type: 'budget/allocate'; id: string; category: BudgetCategory; amount: number }
  | { type: 'budget/spend'; id: string; category: BudgetCategory; amount: number }
  | { type: 'budget/reset'; id: string }
  | { type: 'guest/add'; id: string; guests: Guest[] }
  | { type: 'guest/update'; id: string; guestId: string; changes: Partial<Omit<Guest, 'id'>> }
  | { type: 'guest/remove'; id: string; guestId: string }
  | { type: 'chat/append'; id: string; entry: ChatEntry }
  | { type: 'chat/clear'; id: string };

const MAX_PLANS = 20;
const MAX_CHAT = 40;
const money = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

function updateProgress(
  state: PlansState,
  id: string,
  update: (progress: PlanProgress, saved: SavedPlan) => PlanProgress,
): PlansState {
  return state.map((saved) =>
    saved.id === id ? { ...saved, progress: update(saved.progress, saved) } : saved,
  );
}

export function plansReducer(state: PlansState, action: PlanAction): PlansState {
  switch (action.type) {
    case 'plan/add':
      return [
        {
          id: action.id,
          createdAt: action.at,
          updatedAt: action.at,
          plan: action.plan,
          progress: emptyProgress(),
        },
        ...state,
      ].slice(0, MAX_PLANS);

    case 'plan/replace':
      // Regenerating keeps the user's guests, notes and chat; plan-specific edits reset.
      return state.map((saved) =>
        saved.id === action.id
          ? {
              ...saved,
              plan: action.plan,
              updatedAt: action.at,
              progress: {
                ...emptyProgress(),
                guests: saved.progress.guests,
                chat: saved.progress.chat,
                spent: saved.progress.spent,
                vendorNotes: saved.progress.vendorNotes,
              },
            }
          : saved,
      );

    case 'plan/remove':
      return state.filter((saved) => saved.id !== action.id);

    case 'milestone/toggle':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        milestonesDone: {
          ...p.milestonesDone,
          [action.milestoneId]: !p.milestonesDone[action.milestoneId],
        },
      }));

    case 'milestone/add':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        customMilestones: [...p.customMilestones, action.milestone],
      }));

    case 'milestone/remove':
      return updateProgress(state, action.id, (p) => {
        const { [action.milestoneId]: _removed, ...milestonesDone } = p.milestonesDone;
        return {
          ...p,
          milestonesDone,
          customMilestones: p.customMilestones.filter((m) => m.id !== action.milestoneId),
        };
      });

    case 'vendor/status':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        vendorStatus: { ...p.vendorStatus, [action.vendorId]: action.status },
      }));

    case 'vendor/notes':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        vendorNotes: { ...p.vendorNotes, [action.vendorId]: action.notes.slice(0, 500) },
      }));

    case 'budget/allocate':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        budgetOverrides: { ...p.budgetOverrides, [action.category]: money(action.amount) },
      }));

    case 'budget/spend':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        spent: { ...p.spent, [action.category]: money(action.amount) },
      }));

    case 'budget/reset':
      return updateProgress(state, action.id, (p) => ({ ...p, budgetOverrides: {} }));

    case 'guest/add':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        guests: [...p.guests, ...action.guests],
      }));

    case 'guest/update':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        guests: p.guests.map((g) => (g.id === action.guestId ? { ...g, ...action.changes } : g)),
      }));

    case 'guest/remove':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        guests: p.guests.filter((g) => g.id !== action.guestId),
      }));

    case 'chat/append':
      return updateProgress(state, action.id, (p) => ({
        ...p,
        chat: [...p.chat, action.entry].slice(-MAX_CHAT),
      }));

    case 'chat/clear':
      return updateProgress(state, action.id, (p) => ({ ...p, chat: [] }));
  }
}
