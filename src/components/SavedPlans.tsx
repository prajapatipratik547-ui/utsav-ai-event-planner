import { EVENT_TYPE_META } from '../../shared/constants.js';
import { formatDate, formatINRCompact, relativeDays } from '../../shared/format.js';
import { localToday, routeHref } from '../lib/browser.js';
import { progressStats } from '../state/selectors.js';
import { useAnnounce, usePlans } from '../state/PlansContext.js';
import { Icon } from './Icon.js';

export function SavedPlans() {
  const { plans, dispatch, persisted } = usePlans();
  const announce = useAnnounce();
  const today = localToday();

  if (plans.length === 0) return null;

  return (
    <section className="container saved-section" aria-labelledby="saved-plans-title">
      <div className="section-head">
        <h2 id="saved-plans-title" tabIndex={-1}>
          Your plans
        </h2>
        {!persisted && (
          <p className="badge badge-warning" role="status">
            This browser is not saving plans (private mode?) — export them before closing.
          </p>
        )}
      </div>
      <ul className="saved-grid">
        {plans.map((saved) => {
          const { input } = saved.plan;
          const stats = progressStats(saved, today);
          const percent = stats.tasksTotal
            ? Math.round((stats.tasksDone / stats.tasksTotal) * 100)
            : 0;
          return (
            <li key={saved.id} className="card saved-card">
              <div className="row">
                <span className="badge">
                  <span aria-hidden="true">{EVENT_TYPE_META[input.eventType].icon}</span>
                  {EVENT_TYPE_META[input.eventType].label}
                </span>
                <span className="meta">{relativeDays(stats.daysUntil)}</span>
              </div>
              <h3>
                <a href={routeHref({ name: 'plan', id: saved.id, tab: 'overview' })}>
                  {input.title}
                </a>
              </h3>
              <p className="meta">
                {formatDate(input.date)} · {input.city} · {input.guests} guests ·{' '}
                {formatINRCompact(input.budget)}
              </p>
              <div>
                <span className="meta">
                  {stats.tasksDone}/{stats.tasksTotal} tasks done
                </span>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={`${input.title} task progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
              <div className="row">
                <span />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  aria-label={`Delete ${input.title}`}
                  onClick={() => {
                    if (
                      window.confirm(`Delete the plan “${input.title}”? This cannot be undone.`)
                    ) {
                      dispatch({ type: 'plan/remove', id: saved.id });
                      announce(`Deleted ${input.title}.`);
                    }
                  }}
                >
                  <Icon name="trash" size={16} /> Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
