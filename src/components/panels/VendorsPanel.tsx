import { CATEGORY_META } from '../../../shared/constants.js';
import { formatDate } from '../../../shared/format.js';
import { usePlans } from '../../state/PlansContext.js';
import { VENDOR_STATUS_LABEL, VENDOR_STATUSES, type VendorStatus } from '../../state/types.js';
import type { PanelProps } from '../Dashboard.js';

export function VendorsPanel({ saved, today }: PanelProps) {
  const { dispatch } = usePlans();
  const { vendors } = saved.plan;
  const booked = vendors.filter((v) =>
    ['booked', 'paid'].includes(saved.progress.vendorStatus[v.id] ?? 'todo'),
  ).length;

  return (
    <section aria-labelledby="vendors-title">
      <div className="section-head">
        <div>
          <h2 id="vendors-title">Vendor checklist</h2>
          <p className="hint" style={{ margin: 0 }}>
            {booked} of {vendors.length} booked. Book in date order — each card lists what to
            confirm before you pay.
          </p>
        </div>
      </div>
      <ul className="vendor-grid">
        {vendors.map((vendor) => {
          const status: VendorStatus = saved.progress.vendorStatus[vendor.id] ?? 'todo';
          const overdue = status === 'todo' && vendor.dueDate < today;
          const base = `vendor-${vendor.id}`;
          return (
            <li key={vendor.id} className="card vendor-card" aria-labelledby={`${base}-name`}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h3 id={`${base}-name`}>{vendor.vendor}</h3>
                <span className={`badge status-${status}`}>{VENDOR_STATUS_LABEL[status]}</span>
              </div>
              <div className="task-meta" style={{ marginTop: 0 }}>
                <span>
                  <span
                    className="cat-dot"
                    style={{ background: CATEGORY_META[vendor.category].color }}
                    aria-hidden="true"
                  />{' '}
                  {CATEGORY_META[vendor.category].label}
                </span>
                <span>Book by {formatDate(vendor.dueDate)}</span>
                {overdue && <span className="badge badge-danger">Overdue</span>}
              </div>
              <div>
                <p className="legend" style={{ margin: '0 0 6px' }}>
                  Confirm before booking
                </p>
                <ul>
                  {vendor.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
              <div className="field">
                <label htmlFor={`${base}-status`}>Status</label>
                <select
                  id={`${base}-status`}
                  className="select"
                  value={status}
                  onChange={(e) =>
                    dispatch({
                      type: 'vendor/status',
                      id: saved.id,
                      vendorId: vendor.id,
                      status: e.target.value as VendorStatus,
                    })
                  }
                >
                  {VENDOR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {VENDOR_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${base}-notes`}>Notes, quotes & contacts</label>
                <textarea
                  id={`${base}-notes`}
                  className="textarea"
                  style={{ minHeight: 72 }}
                  maxLength={500}
                  value={saved.progress.vendorNotes[vendor.id] ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'vendor/notes',
                      id: saved.id,
                      vendorId: vendor.id,
                      notes: e.target.value,
                    })
                  }
                  placeholder="e.g. Quote ₹1,200/plate, tasting on Sat"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
