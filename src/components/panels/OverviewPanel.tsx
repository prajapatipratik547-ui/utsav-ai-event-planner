import { CATEGORY_META } from '../../../shared/constants.js';
import { formatDate, formatINR, relativeDays } from '../../../shared/format.js';
import { daysBetween } from '../../../shared/date.js';
import type { BudgetHealth } from '../../../shared/types.js';
import { upcoming } from '../../state/selectors.js';
import { usePlans } from '../../state/PlansContext.js';
import type { PanelProps } from '../Dashboard.js';
import { Icon } from '../Icon.js';

const HEALTH: Record<BudgetHealth, { label: string; className: string; text: string }> = {
  comfortable: {
    label: 'Comfortable',
    className: 'badge-success',
    text: 'Your budget has healthy headroom for this guest count.',
  },
  balanced: {
    label: 'Balanced',
    className: 'badge-warning',
    text: 'Your budget fits typical costs — keep an eye on add-ons.',
  },
  tight: {
    label: 'Tight',
    className: 'badge-danger',
    text: 'Costs will be tight — see the suggestions below.',
  },
};

export function OverviewPanel({
  saved,
  today,
  onOpenTab,
}: PanelProps & { onOpenTab: (tab: 'budget' | 'timeline' | 'ideas' | 'assistant') => void }) {
  const { dispatch } = usePlans();
  const { plan } = saved;
  const next = upcoming(saved, today, 4);
  const health = HEALTH[plan.budget.health];

  return (
    <div className="panel-grid two">
      <div className="stack">
        <section className="card" aria-labelledby="summary-title">
          <h2 id="summary-title">Your plan in a nutshell</h2>
          <p
            className="summary-text"
            lang={plan.input.language === 'hi' && plan.source !== 'offline' ? 'hi' : undefined}
          >
            {plan.summary}
          </p>
          {plan.budget.warnings.length > 0 && (
            <div className="alert" role="note" aria-label="Things to watch">
              <Icon name="alert" />
              <ul>
                {plan.budget.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="next-title">
          <div className="section-head">
            <h2 id="next-title">Up next</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpenTab('timeline')}
            >
              Full timeline <Icon name="calendar" size={16} />
            </button>
          </div>
          {next.length === 0 ? (
            <p className="empty">Every task is done. Time to celebrate!</p>
          ) : (
            <ul className="task-list">
              {next.map((m) => {
                const days = daysBetween(today, m.dueDate);
                const inputId = `overview-task-${m.id}`;
                return (
                  <li key={m.id} className={`task-row${m.overdue ? ' overdue' : ''}`}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={m.done}
                      onChange={() =>
                        dispatch({ type: 'milestone/toggle', id: saved.id, milestoneId: m.id })
                      }
                    />
                    <div className="task-body">
                      <label className="task-title" htmlFor={inputId}>
                        {m.title}
                      </label>
                      <div className="task-meta">
                        <span>
                          <Icon name="clock" size={14} className="inline" /> {formatDate(m.dueDate)}{' '}
                          ({relativeDays(days)})
                        </span>
                        {m.overdue && <span className="badge badge-danger">Overdue</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="stack">
        <section className="card" aria-labelledby="health-title">
          <div className="section-head">
            <h2 id="health-title">Budget health</h2>
            <span className={`badge ${health.className}`}>{health.label}</span>
          </div>
          <p>{health.text}</p>
          <dl className="kv">
            <div>
              <dt>Per guest</dt>
              <dd>{formatINR(plan.budget.perGuest)}</dd>
            </div>
            <div>
              <dt>Catering per plate</dt>
              <dd>{formatINR(plan.budget.perPlate)}</dd>
            </div>
            <div>
              <dt>Typical in {plan.input.city}</dt>
              <dd>{formatINR(plan.budget.typicalPlateCost)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ marginTop: 16 }}
            onClick={() => onOpenTab('budget')}
          >
            Open budget <Icon name="wallet" size={16} />
          </button>
        </section>

        <section className="card theme-card" aria-labelledby="theme-title">
          <p className="eyebrow">Theme</p>
          <h2 id="theme-title" className="theme-name">
            {plan.ideas.theme.name}
          </h2>
          <p>{plan.ideas.theme.description}</p>
          <ul className="palette" aria-label="Colour palette">
            {plan.ideas.theme.palette.map((color) => (
              <li key={color} className="swatch">
                <span style={{ background: color }} aria-hidden="true" />
                <span>{color.toUpperCase()}</span>
              </li>
            ))}
          </ul>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onOpenTab('ideas')}
            >
              All ideas <Icon name="palette" size={16} />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onOpenTab('assistant')}
            >
              Ask the assistant <Icon name="message" size={16} />
            </button>
          </div>
        </section>

        <section className="card" aria-labelledby="top-lines-title">
          <h2 id="top-lines-title">Biggest budget lines</h2>
          <ul className="legend-list">
            {[...plan.budget.lines]
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 4)
              .map((line) => (
                <li key={line.category}>
                  <span
                    className="cat-dot"
                    style={{ background: CATEGORY_META[line.category].color }}
                    aria-hidden="true"
                  />
                  {line.label}
                  <span className="amt">
                    {formatINR(line.amount)} · {line.percent}%
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
