import { useId, useState, type FormEvent } from 'react';
import { CATEGORY_META, TASK_CATEGORIES, type TaskCategory } from '../../../shared/constants.js';
import { daysBetween, isValidIsoDate } from '../../../shared/date.js';
import { formatDate, relativeDays } from '../../../shared/format.js';
import { cleanUserText } from '../../../shared/text.js';
import { uid } from '../../lib/browser.js';
import { timelineItems, type TimelineItem } from '../../state/selectors.js';
import { useAnnounce, usePlans } from '../../state/PlansContext.js';
import type { PanelProps } from '../Dashboard.js';
import { Icon } from '../Icon.js';

const monthLabel = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function groupByMonth(items: TimelineItem[]): [string, TimelineItem[]][] {
  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = monthLabel.format(new Date(`${item.dueDate}T00:00:00Z`));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups];
}

function AddTaskForm({
  planId,
  eventDate,
  today,
}: {
  planId: string;
  eventDate: string;
  today: string;
}) {
  const { dispatch } = usePlans();
  const announce = useAnnounce();
  const id = useId();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<TaskCategory>('planning');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = cleanUserText(title, 90);
    if (clean.length < 2) return setError('Give the task a short name.');
    if (!isValidIsoDate(date)) return setError('Choose a valid date.');
    dispatch({
      type: 'milestone/add',
      id: planId,
      milestone: {
        id: `custom-${uid()}`,
        title: clean,
        detail: 'Added by you.',
        category,
        daysBefore: daysBetween(date, eventDate),
        dueDate: date,
      },
    });
    setTitle('');
    setError('');
    announce(`Added task ${clean}.`);
  };

  return (
    <form className="card" onSubmit={submit} aria-labelledby={`${id}-title`} noValidate>
      <h2 id={`${id}-title`}>Add your own task</h2>
      <div className="grid-2">
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor={`${id}-name`}>Task</label>
          <input
            id={`${id}-name`}
            className="input"
            value={title}
            maxLength={90}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            placeholder="e.g. Order welcome hampers"
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-date`}>Due date</label>
          <input
            id={`${id}-date`}
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-cat`}>Category</label>
          <select
            id={`${id}-cat`}
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
          >
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }}>
        <Icon name="plus" /> Add task
      </button>
    </form>
  );
}

export function TimelinePanel({ saved, today }: PanelProps) {
  const { dispatch } = usePlans();
  const [hideDone, setHideDone] = useState(false);
  const all = timelineItems(saved, today);
  const items = hideDone ? all.filter((m) => !m.done) : all;
  const done = all.filter((m) => m.done).length;

  return (
    <div className="panel-grid two">
      <section aria-labelledby="timeline-title">
        <div className="section-head">
          <div>
            <h2 id="timeline-title">Countdown timeline</h2>
            <p className="hint" style={{ margin: 0 }}>
              {done} of {all.length} tasks complete
            </p>
          </div>
          <label className="choice" style={{ padding: '8px 14px' }}>
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
            />
            <strong>Hide completed</strong>
          </label>
        </div>
        {saved.plan.compressed && (
          <p className="alert">
            <Icon name="clock" />
            Your date is closer than the usual planning window, so the standard lead times were
            compressed to fit.
          </p>
        )}
        {items.length === 0 && <p className="empty">Nothing left to do here — lovely work.</p>}
        {groupByMonth(items).map(([month, group]) => (
          <div className="month-group" key={month}>
            <h3>{month}</h3>
            <ul className="task-list">
              {group.map((m) => {
                const inputId = `task-${m.id}`;
                return (
                  <li
                    key={m.id}
                    className={`task-row${m.done ? ' done' : ''}${m.overdue ? ' overdue' : ''}`}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={m.done}
                      aria-describedby={`${inputId}-meta`}
                      onChange={() =>
                        dispatch({ type: 'milestone/toggle', id: saved.id, milestoneId: m.id })
                      }
                    />
                    <div className="task-body">
                      <label className="task-title" htmlFor={inputId}>
                        {m.title}
                      </label>
                      <p className="task-detail">{m.detail}</p>
                      <div className="task-meta" id={`${inputId}-meta`}>
                        <span>
                          <span
                            className="cat-dot"
                            style={{ background: CATEGORY_META[m.category].color }}
                            aria-hidden="true"
                          />{' '}
                          {CATEGORY_META[m.category].label}
                        </span>
                        <span>
                          Due {formatDate(m.dueDate)} ({relativeDays(daysBetween(today, m.dueDate))}
                          )
                        </span>
                        {m.overdue && <span className="badge badge-danger">Overdue</span>}
                        {m.id.startsWith('ai-') && (
                          <span className="badge badge-ai">AI suggestion</span>
                        )}
                      </div>
                    </div>
                    {m.custom && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`Remove task ${m.title}`}
                        onClick={() =>
                          dispatch({ type: 'milestone/remove', id: saved.id, milestoneId: m.id })
                        }
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      <div className="stack">
        <AddTaskForm planId={saved.id} eventDate={saved.plan.input.date} today={today} />
      </div>
    </div>
  );
}
