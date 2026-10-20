import { CATEGORY_META } from '../../../shared/constants.js';
import { formatINR, formatINRCompact } from '../../../shared/format.js';
import { budgetSummary, type BudgetRow } from '../../state/selectors.js';
import { useAnnounce, usePlans } from '../../state/PlansContext.js';
import type { PanelProps } from '../Dashboard.js';
import { Icon } from '../Icon.js';

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Donut of allocations. The table below carries the same data for screen readers. */
export function DonutChart({ rows, total }: { rows: BudgetRow[]; total: number }) {
  const sum = rows.reduce((s, r) => s + r.allocated, 0) || 1;
  const segments = rows.map((row, index) => ({
    row,
    length: (row.allocated / sum) * CIRCUMFERENCE,
    offset: rows.slice(0, index).reduce((s, r) => s + (r.allocated / sum) * CIRCUMFERENCE, 0),
  }));
  const description = rows
    .map((r) => `${r.label} ${Math.round((r.allocated / sum) * 100)}%`)
    .join(', ');
  return (
    <figure className="donut-wrap" style={{ margin: 0 }}>
      <svg
        viewBox="0 0 180 180"
        width="220"
        height="220"
        role="img"
        aria-label={`Budget split: ${description}`}
      >
        <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="var(--surface-3)" strokeWidth="26" />
        {segments.map(({ row, length, offset }) => (
          <circle
            key={row.category}
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke={CATEGORY_META[row.category].color}
            strokeWidth="26"
            strokeDasharray={`${Math.max(0, length - 1.5)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 90 90)"
          />
        ))}
        <text
          x="90"
          y="86"
          textAnchor="middle"
          className="donut-center"
          fontSize="22"
          fontWeight="700"
          fill="var(--ink)"
        >
          {formatINRCompact(total)}
        </text>
        <text x="90" y="108" textAnchor="middle" fontSize="11" fill="var(--muted)">
          total budget
        </text>
      </svg>
      <figcaption className="sr-only">Budget split by category</figcaption>
    </figure>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      className="input money-input"
      type="number"
      inputMode="numeric"
      min={0}
      step={500}
      aria-label={label}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  );
}

export function BudgetPanel({ saved }: PanelProps) {
  const { dispatch } = usePlans();
  const announce = useAnnounce();
  const summary = budgetSummary(saved);
  const hasOverrides = Object.keys(saved.progress.budgetOverrides).length > 0;

  return (
    <div className="panel-grid two">
      <section className="card" aria-labelledby="budget-table-title">
        <div className="section-head">
          <h2 id="budget-table-title">Allocate & track</h2>
          {hasOverrides && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                dispatch({ type: 'budget/reset', id: saved.id });
                announce('Budget reset to the suggested split.');
              }}
            >
              <Icon name="refresh" size={16} /> Reset to suggested
            </button>
          )}
        </div>
        <p className="hint">
          Edit any allocation or log what you have spent — totals update instantly.
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Budget by category with allocation, spending and remaining amounts
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  Allocated
                </th>
                <th scope="col" className="num">
                  Spent
                </th>
                <th scope="col" className="num">
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.category}>
                  <th scope="row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="cat-dot"
                        style={{ background: CATEGORY_META[row.category].color }}
                        aria-hidden="true"
                      />
                      {row.label}
                    </span>
                    {row.note && (
                      <span className="hint" style={{ fontWeight: 400 }}>
                        {row.note}
                      </span>
                    )}
                    {row.allocated !== row.suggested && (
                      <span className="hint" style={{ display: 'block', fontWeight: 400 }}>
                        Suggested {formatINR(row.suggested)}
                      </span>
                    )}
                  </th>
                  <td className="num">
                    <MoneyInput
                      label={`${row.label} allocated amount`}
                      value={row.allocated}
                      onChange={(amount) =>
                        dispatch({
                          type: 'budget/allocate',
                          id: saved.id,
                          category: row.category,
                          amount,
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    <MoneyInput
                      label={`${row.label} amount spent`}
                      value={row.spent}
                      onChange={(amount) =>
                        dispatch({
                          type: 'budget/spend',
                          id: saved.id,
                          category: row.category,
                          amount,
                        })
                      }
                    />
                  </td>
                  <td className={`num${row.remaining < 0 ? ' negative' : ''}`}>
                    {formatINR(row.remaining)}
                    {row.remaining < 0 && <span className="sr-only"> (over budget)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="num">{formatINR(summary.allocated)}</td>
                <td className="num">{formatINR(summary.spent)}</td>
                <td className={`num${summary.allocated - summary.spent < 0 ? ' negative' : ''}`}>
                  {formatINR(summary.allocated - summary.spent)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div aria-live="polite" style={{ marginTop: 14 }}>
          {summary.unallocated !== 0 && (
            <p className={`alert ${summary.unallocated < 0 ? 'alert-danger' : 'alert-info'}`}>
              <Icon name="alert" />
              {summary.unallocated > 0
                ? `${formatINR(summary.unallocated)} of your ${formatINR(summary.total)} budget is not allocated yet.`
                : `Allocations exceed your budget by ${formatINR(-summary.unallocated)}. Trim a category or raise the budget.`}
            </p>
          )}
          {summary.overspentCategories.length > 0 && (
            <p className="alert alert-danger">
              <Icon name="alert" />
              Over budget in:{' '}
              {summary.overspentCategories.map((c) => CATEGORY_META[c].label).join(', ')}.
            </p>
          )}
        </div>
      </section>

      <div className="stack">
        <section className="card" aria-labelledby="split-title">
          <h2 id="split-title">The split</h2>
          <DonutChart rows={summary.rows} total={summary.total} />
          <ul className="legend-list" style={{ marginTop: 16 }}>
            {summary.rows.map((row) => (
              <li key={row.category}>
                <span
                  className="cat-dot"
                  style={{ background: CATEGORY_META[row.category].color }}
                  aria-hidden="true"
                />
                {row.label}
                <span className="amt">{formatINRCompact(row.allocated)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card" aria-labelledby="how-title">
          <h2 id="how-title">How this split was made</h2>
          <p className="hint" style={{ marginBottom: 0 }}>
            We start from typical shares for a {saved.plan.input.eventType.replace('-', ' ')},
            adjust for your style and priorities
            {saved.plan.source !== 'offline'
              ? ', apply the AI planner’s emphasis for your event'
              : ''}
            , keep a contingency reserve, and round to ₹100 so every rupee is accounted for.
            Per-plate costs are indicative for {saved.plan.input.city}.
          </p>
        </section>
      </div>
    </div>
  );
}
