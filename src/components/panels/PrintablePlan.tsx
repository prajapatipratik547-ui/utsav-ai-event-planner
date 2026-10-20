import { formatDate, formatINR, formatLongDate } from '../../../shared/format.js';
import { budgetSummary, timelineItems } from '../../state/selectors.js';
import type { PanelProps } from '../Dashboard.js';

/** A complete, linear version of the plan that only appears when printing. */
export function PrintablePlan({ saved, today }: PanelProps) {
  const { plan } = saved;
  const budget = budgetSummary(saved);
  return (
    <div className="print-only container" aria-hidden="true">
      <h2>Summary</h2>
      <p>{plan.summary}</p>
      <p>
        {formatLongDate(plan.input.date)} · {plan.input.city} · {plan.input.guests} guests · Budget{' '}
        {formatINR(plan.budget.total)}
      </p>
      <h2>Budget</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Allocated</th>
            <th className="num">Spent</th>
          </tr>
        </thead>
        <tbody>
          {budget.rows.map((r) => (
            <tr key={r.category}>
              <td>{r.label}</td>
              <td className="num">{formatINR(r.allocated)}</td>
              <td className="num">{formatINR(r.spent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Timeline</h2>
      <ul>
        {timelineItems(saved, today).map((m) => (
          <li key={m.id}>
            {m.done ? '☑' : '☐'} {formatDate(m.dueDate)} — {m.title}
          </li>
        ))}
      </ul>
      <h2>Vendors</h2>
      <ul>
        {plan.vendors.map((v) => (
          <li key={v.id}>
            {v.vendor} — book by {formatDate(v.dueDate)}
          </li>
        ))}
      </ul>
      <h2>Theme: {plan.ideas.theme.name}</h2>
      <p>{plan.ideas.theme.description}</p>
      <h3>Menu</h3>
      <ul>
        {plan.ideas.menu.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <h3>Decor</h3>
      <ul>
        {plan.ideas.decor.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
