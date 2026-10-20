import { useId, useState, type FormEvent } from 'react';
import { formatINR } from '../../../shared/format.js';
import { cleanUserText } from '../../../shared/text.js';
import { uid } from '../../lib/browser.js';
import { budgetSummary, guestStats } from '../../state/selectors.js';
import { useAnnounce, usePlans } from '../../state/PlansContext.js';
import { RSVP_LABEL, RSVP_STATUSES, type Guest, type RsvpStatus } from '../../state/types.js';
import type { PanelProps } from '../Dashboard.js';
import { Icon } from '../Icon.js';

const MAX_GUESTS = 2_000;
const clampParty = (n: number) => Math.min(20, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));

export function GuestsPanel({ saved }: PanelProps) {
  const { dispatch } = usePlans();
  const announce = useAnnounce();
  const id = useId();
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [party, setParty] = useState('1');
  const [rsvp, setRsvp] = useState<RsvpStatus>('pending');
  const [bulk, setBulk] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<RsvpStatus | 'all'>('all');

  const stats = guestStats(saved);
  const perPlate = budgetSummary(saved).rows.find((r) => r.category === 'catering')?.allocated ?? 0;
  const platePrice = saved.plan.input.guests ? perPlate / saved.plan.input.guests : 0;
  const guests = saved.progress.guests;
  const visible = filter === 'all' ? guests : guests.filter((g) => g.rsvp === filter);
  const room = MAX_GUESTS - guests.length;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const clean = cleanUserText(name, 80);
    if (clean.length < 1) return setError('Enter a guest or family name.');
    if (room <= 0) return setError(`Guest list is limited to ${MAX_GUESTS} invitations.`);
    dispatch({
      type: 'guest/add',
      id: saved.id,
      guests: [
        {
          id: uid(),
          name: clean,
          group: cleanUserText(group, 40),
          partySize: clampParty(Number(party)),
          rsvp,
        },
      ],
    });
    setName('');
    setError('');
    announce(`Added ${clean} to the guest list.`);
  };

  const addBulk = () => {
    const names = bulk
      .split(/\r?\n/)
      .map((line) => cleanUserText(line, 80))
      .filter(Boolean)
      .slice(0, Math.max(0, room));
    if (names.length === 0) return;
    const newGuests: Guest[] = names.map((n) => ({
      id: uid(),
      name: n,
      group: cleanUserText(group, 40),
      partySize: 1,
      rsvp: 'pending',
    }));
    dispatch({ type: 'guest/add', id: saved.id, guests: newGuests });
    setBulk('');
    announce(`Added ${names.length} guests.`);
  };

  return (
    <div className="stack">
      <ul className="stats" aria-label="RSVP summary" style={{ marginTop: 0 }}>
        <li className="stat">
          <div className="label">Invitations</div>
          <div className="value">{stats.invitations}</div>
          <div className="sub">{stats.people} people in total</div>
        </li>
        <li className="stat">
          <div className="label">Attending</div>
          <div className="value">{stats.attending}</div>
          <div className="sub">confirmed people</div>
        </li>
        <li className="stat">
          <div className="label">Awaiting</div>
          <div className="value">{stats.pending}</div>
          <div className="sub">{stats.declined} declined</div>
        </li>
        <li className="stat">
          <div className="label">Catering estimate</div>
          <div className="value">
            {formatINR(Math.round(platePrice * (stats.attending + stats.pending)))}
          </div>
          <div className="sub">attending + awaiting × {formatINR(platePrice)}/plate</div>
        </li>
      </ul>

      <section className="card" aria-labelledby={`${id}-add`}>
        <h2 id={`${id}-add`}>Add guests</h2>
        <form className="inline-form" onSubmit={add} noValidate>
          <div className="field">
            <label htmlFor={`${id}-name`}>Name or family</label>
            <input
              id={`${id}-name`}
              className="input"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-group`}>Group (optional)</label>
            <input
              id={`${id}-group`}
              className="input"
              value={group}
              maxLength={40}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. Bride’s side"
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-party`}>People</label>
            <input
              id={`${id}-party`}
              className="input"
              type="number"
              min={1}
              max={20}
              value={party}
              onChange={(e) => setParty(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-rsvp`}>RSVP</label>
            <select
              id={`${id}-rsvp`}
              className="select"
              value={rsvp}
              onChange={(e) => setRsvp(e.target.value as RsvpStatus)}
            >
              {RSVP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RSVP_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">
            <Icon name="plus" /> Add
          </button>
        </form>
        {error && (
          <p className="error-text" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Paste a list of names</summary>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor={`${id}-bulk`}>One name per line (uses the group above)</label>
            <textarea
              id={`${id}-bulk`}
              className="textarea"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 10 }}
            onClick={addBulk}
          >
            Add all
          </button>
        </details>
      </section>

      <section className="card" aria-labelledby={`${id}-list`}>
        <div className="section-head">
          <h2 id={`${id}-list`}>Guest list</h2>
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor={`${id}-filter`} className="sr-only">
              Filter by RSVP
            </label>
            <select
              id={`${id}-filter`}
              className="select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as RsvpStatus | 'all')}
            >
              <option value="all">All guests</option>
              {RSVP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RSVP_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="empty">
            {guests.length === 0
              ? 'No guests yet. Add your first above.'
              : 'No guests match this filter.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="guest-table">
              <caption className="sr-only">Guests with group, party size and RSVP status</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Group</th>
                  <th scope="col" className="num">
                    People
                  </th>
                  <th scope="col">RSVP</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g.group || '—'}</td>
                    <td className="num">
                      <input
                        className="input money-input"
                        style={{ width: 80 }}
                        type="number"
                        min={1}
                        max={20}
                        aria-label={`People in ${g.name}’s party`}
                        value={g.partySize}
                        onChange={(e) =>
                          dispatch({
                            type: 'guest/update',
                            id: saved.id,
                            guestId: g.id,
                            changes: { partySize: clampParty(Number(e.target.value)) },
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="select"
                        style={{ minHeight: 38 }}
                        aria-label={`RSVP for ${g.name}`}
                        value={g.rsvp}
                        onChange={(e) =>
                          dispatch({
                            type: 'guest/update',
                            id: saved.id,
                            guestId: g.id,
                            changes: { rsvp: e.target.value as RsvpStatus },
                          })
                        }
                      >
                        {RSVP_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {RSVP_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`Remove ${g.name}`}
                        onClick={() => {
                          dispatch({ type: 'guest/remove', id: saved.id, guestId: g.id });
                          announce(`Removed ${g.name}.`);
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
