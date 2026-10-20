import { useEffect, useRef, useState } from 'react';
import { DIET_META, EVENT_TYPE_META, STYLE_META } from '../../shared/constants.js';
import { formatINR, formatINRCompact, formatLongDate, pluralize } from '../../shared/format.js';
import { buildIcs } from '../../shared/ics.js';
import { slugify } from '../../shared/text.js';
import type { PlanSource } from '../../shared/types.js';
import { ApiError, requestPlan } from '../lib/api.js';
import { downloadFile, localToday, navigate } from '../lib/browser.js';
import { budgetSummary, guestStats, progressStats, timelineItems } from '../state/selectors.js';
import { useAnnounce, usePlans } from '../state/PlansContext.js';
import type { SavedPlan } from '../state/types.js';
import { Icon } from './Icon.js';
import { AssistantPanel } from './panels/AssistantPanel.js';
import { BudgetPanel } from './panels/BudgetPanel.js';
import { GuestsPanel } from './panels/GuestsPanel.js';
import { IdeasPanel } from './panels/IdeasPanel.js';
import { OverviewPanel } from './panels/OverviewPanel.js';
import { PrintablePlan } from './panels/PrintablePlan.js';
import { TimelinePanel } from './panels/TimelinePanel.js';
import { VendorsPanel } from './panels/VendorsPanel.js';
import { Tabs, type TabDef } from './Tabs.js';

const TAB_IDS = [
  'overview',
  'budget',
  'timeline',
  'vendors',
  'ideas',
  'guests',
  'assistant',
] as const;
type TabId = (typeof TAB_IDS)[number];
const isTab = (value: string | undefined): value is TabId => TAB_IDS.includes(value as TabId);

export const SOURCE_LABEL: Record<PlanSource, string> = {
  gemini: 'Personalised by Google Gemini',
  groq: 'Personalised by AI (Groq)',
  offline: 'Built by the offline planner',
};

export interface PanelProps {
  saved: SavedPlan;
  today: string;
}

function StatTiles({ saved, today }: PanelProps) {
  const stats = progressStats(saved, today);
  const budget = budgetSummary(saved);
  const guests = guestStats(saved);
  const spentPct = budget.total
    ? Math.min(100, Math.round((budget.spent / budget.total) * 100))
    : 0;
  const taskPct = stats.tasksTotal ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0;
  const countdown =
    stats.daysUntil > 0
      ? pluralize(stats.daysUntil, 'day')
      : stats.daysUntil === 0
        ? 'Today!'
        : 'Done';

  return (
    <ul className="stats" aria-label="Plan at a glance">
      <li className="stat stat-countdown">
        <div className="label">Countdown</div>
        <div className="value">{countdown}</div>
        <div className="sub">{formatLongDate(saved.plan.input.date)}</div>
      </li>
      <li className="stat">
        <div className="label">Spent</div>
        <div className="value">{formatINRCompact(budget.spent)}</div>
        <div className="sub">of {formatINR(budget.total)}</div>
        <div
          className={`progress${budget.spent > budget.total ? ' over' : ''}`}
          role="progressbar"
          aria-label="Budget spent"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={spentPct}
        >
          <span style={{ width: `${spentPct}%` }} />
        </div>
      </li>
      <li className="stat">
        <div className="label">Tasks</div>
        <div className="value">
          {stats.tasksDone}/{stats.tasksTotal}
        </div>
        <div className="sub">
          {stats.vendorsBooked} of {stats.vendorsTotal} vendors booked
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Tasks completed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={taskPct}
        >
          <span style={{ width: `${taskPct}%` }} />
        </div>
      </li>
      <li className="stat">
        <div className="label">Guests</div>
        <div className="value">{guests.attending || saved.plan.input.guests}</div>
        <div className="sub">
          {guests.invitations
            ? `${guests.attending} attending · ${guests.pending} awaiting`
            : 'planned headcount'}
        </div>
      </li>
    </ul>
  );
}

export default function Dashboard({ id, tab }: { id: string; tab: string | undefined }) {
  const { plans, dispatch } = usePlans();
  const announce = useAnnounce();
  const saved = plans.find((p) => p.id === id);
  const active: TabId = isTab(tab) ? tab : 'overview';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [regenerating, setRegenerating] = useState(false);
  const today = localToday();

  useEffect(() => {
    headingRef.current?.focus();
  }, [id]);

  useEffect(() => {
    if (saved) document.title = `${saved.plan.input.title} · Utsav`;
  }, [saved]);

  if (!saved) {
    return (
      <div className="container empty">
        <h1 ref={headingRef} tabIndex={-1}>
          Plan not found
        </h1>
        <p>It may have been deleted, or it was created in another browser.</p>
        <a className="btn btn-primary" href="#/">
          Plan a new celebration
        </a>
      </div>
    );
  }

  const { plan } = saved;
  const { input } = plan;
  const guests = guestStats(saved);
  const openTasks = timelineItems(saved, today).filter((m) => !m.done).length;

  const tabs: TabDef<TabId>[] = [
    { id: 'overview', label: 'Overview', icon: 'overview' },
    { id: 'budget', label: 'Budget', icon: 'wallet' },
    { id: 'timeline', label: 'Timeline', icon: 'calendar', count: openTasks },
    { id: 'vendors', label: 'Vendors', icon: 'store', count: plan.vendors.length },
    { id: 'ideas', label: 'Ideas', icon: 'palette' },
    { id: 'guests', label: 'Guests', icon: 'users', count: guests.invitations },
    { id: 'assistant', label: 'Assistant', icon: 'message' },
  ];

  const exportCalendar = () => {
    const items = timelineItems(saved, today)
      .filter((m) => !m.done)
      .map((m) => ({
        uid: `${saved.id}-${m.id}`,
        title: `${m.title} · ${input.title}`,
        description: m.detail,
        date: m.dueDate,
      }));
    downloadFile(
      `${slugify(input.title) || 'utsav-plan'}.ics`,
      buildIcs(input.title, items),
      'text/calendar;charset=utf-8',
    );
    announce(`Calendar file with ${items.length} tasks downloaded.`);
  };

  const exportJson = () => {
    downloadFile(
      `${slugify(input.title) || 'utsav-plan'}.json`,
      JSON.stringify(saved, null, 2),
      'application/json',
    );
    announce('Plan downloaded as JSON.');
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        'Regenerate this plan? Your guests, spending and chat are kept; task ticks and budget edits reset.',
      )
    )
      return;
    setRegenerating(true);
    announce('Regenerating your plan.');
    try {
      let next;
      try {
        next = (await requestPlan(input, today)).plan;
      } catch (error) {
        if (error instanceof ApiError && error.recoverable)
          next = (await import('../../shared/engine/planner.js')).buildPlan(input, { today });
        else throw error;
      }
      dispatch({ type: 'plan/replace', id: saved.id, plan: next, at: new Date().toISOString() });
      announce('Your plan has been regenerated.');
    } catch (error) {
      announce(error instanceof ApiError ? error.message : 'Could not regenerate the plan.');
    } finally {
      setRegenerating(false);
    }
  };

  const remove = () => {
    if (!window.confirm(`Delete “${input.title}”? This cannot be undone.`)) return;
    dispatch({ type: 'plan/remove', id: saved.id });
    announce(`Deleted ${input.title}.`);
    navigate({ name: 'home' });
  };

  const panelProps = { saved, today };

  return (
    <>
      <div className="container dash-head">
        <a className="back-link" href="#/">
          <Icon name="back" /> All plans
        </a>
        <div className="dash-title-row">
          <div>
            <span className={`badge ${plan.source === 'offline' ? '' : 'badge-ai'}`}>
              <Icon name="sparkles" size={14} /> {SOURCE_LABEL[plan.source]}
            </span>
            <h1 ref={headingRef} tabIndex={-1}>
              {input.title}
            </h1>
            <ul className="meta-row">
              <li>
                <span aria-hidden="true">{EVENT_TYPE_META[input.eventType].icon}</span>{' '}
                {EVENT_TYPE_META[input.eventType].label}
              </li>
              <li>
                <Icon name="calendar" size={16} /> {formatLongDate(input.date)}
              </li>
              <li>
                <Icon name="pin" size={16} /> {input.city}
              </li>
              <li>
                <Icon name="users" size={16} /> {input.guests} guests
              </li>
              <li>
                {STYLE_META[input.style].label} · {DIET_META[input.diet]}
              </li>
            </ul>
          </div>
          <div className="toolbar" role="group" aria-label="Plan actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={exportCalendar}>
              <Icon name="calendar" size={16} /> Add to calendar
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
              <Icon name="printer" size={16} /> Print / PDF
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportJson}>
              <Icon name="download" size={16} /> Export
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void regenerate()}
              disabled={regenerating}
              aria-busy={regenerating}
            >
              <Icon name="refresh" size={16} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              <Icon name="trash" size={16} /> Delete
            </button>
          </div>
        </div>
        <StatTiles {...panelProps} />
      </div>

      <div className="screen-only">
        <Tabs
          label="Plan sections"
          tabs={tabs}
          active={active}
          onChange={(next) =>
            navigate({ name: 'plan', id: saved.id, tab: next }, { replace: true })
          }
        >
          {active === 'overview' && (
            <OverviewPanel
              {...panelProps}
              onOpenTab={(next) =>
                navigate({ name: 'plan', id: saved.id, tab: next }, { replace: true })
              }
            />
          )}
          {active === 'budget' && <BudgetPanel {...panelProps} />}
          {active === 'timeline' && <TimelinePanel {...panelProps} />}
          {active === 'vendors' && <VendorsPanel {...panelProps} />}
          {active === 'ideas' && <IdeasPanel {...panelProps} />}
          {active === 'guests' && <GuestsPanel {...panelProps} />}
          {active === 'assistant' && <AssistantPanel {...panelProps} />}
        </Tabs>
      </div>
      <PrintablePlan {...panelProps} />
    </>
  );
}
