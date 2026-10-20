import type { BudgetCategory } from '../../shared/constants.js';
import type { ChatMessage } from '../../shared/schema.js';
import type { EventPlan, Milestone, PlanSource } from '../../shared/types.js';

export const VENDOR_STATUSES = ['todo', 'contacted', 'booked', 'paid'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  todo: 'To contact',
  contacted: 'Contacted',
  booked: 'Booked',
  paid: 'Paid',
};

export const RSVP_STATUSES = ['pending', 'yes', 'no'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  pending: 'Awaiting reply',
  yes: 'Attending',
  no: 'Not attending',
};

export interface Guest {
  id: string;
  name: string;
  group: string;
  /** Number of people in this invitation, including the guest. */
  partySize: number;
  rsvp: RsvpStatus;
}

export interface ChatEntry extends ChatMessage {
  id: string;
  source?: PlanSource;
}

/** Everything the user changes after a plan is generated. */
export interface PlanProgress {
  milestonesDone: Record<string, boolean>;
  customMilestones: Milestone[];
  vendorStatus: Record<string, VendorStatus>;
  vendorNotes: Record<string, string>;
  budgetOverrides: Partial<Record<BudgetCategory, number>>;
  spent: Partial<Record<BudgetCategory, number>>;
  guests: Guest[];
  chat: ChatEntry[];
}

export interface SavedPlan {
  id: string;
  createdAt: string;
  updatedAt: string;
  plan: EventPlan;
  progress: PlanProgress;
}

export const emptyProgress = (): PlanProgress => ({
  milestonesDone: {},
  customMilestones: [],
  vendorStatus: {},
  vendorNotes: {},
  budgetOverrides: {},
  spent: {},
  guests: [],
  chat: [],
});
