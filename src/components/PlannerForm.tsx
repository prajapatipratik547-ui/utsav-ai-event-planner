import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  CATEGORY_META,
  DIET_META,
  DIETS,
  EVENT_TYPE_META,
  EVENT_TYPES,
  LANGUAGE_META,
  LANGUAGES,
  LIMITS,
  PRIORITY_CATEGORIES,
  STYLE_META,
  STYLES,
  type Diet,
  type EventType,
  type Language,
  type PriorityCategory,
  type Style,
} from '../../shared/constants.js';
import { addDays, daysBetween } from '../../shared/date.js';
import { formatINR, formatINRCompact } from '../../shared/format.js';
import type { EventInput } from '../../shared/schema.js';
import { ApiError, requestPlan } from '../lib/api.js';
import { localToday, navigate, uid } from '../lib/browser.js';
import { useAnnounce, usePlans } from '../state/PlansContext.js';
import { Icon } from './Icon.js';

interface FormValues {
  eventType: EventType;
  title: string;
  date: string;
  city: string;
  guests: string;
  budget: string;
  style: Style;
  diet: Diet;
  priorities: PriorityCategory[];
  notes: string;
  language: Language;
}

const POPULAR_CITIES = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Indore',
  'Kochi',
  'Chandigarh',
  'Goa',
  'Udaipur',
];

export const EXAMPLES: (Omit<FormValues, 'date'> & { inDays: number })[] = [
  {
    eventType: 'wedding',
    title: 'Aarav & Diya’s Wedding',
    city: 'Jaipur',
    guests: '300',
    budget: '2500000',
    style: 'traditional',
    diet: 'vegetarian',
    priorities: ['catering', 'photography'],
    notes:
      'Rajasthani touches please. Grandparents are attending, so seating and accessibility matter. We would love an eco-friendly mehendi.',
    language: 'en',
    inDays: 150,
  },
  {
    eventType: 'birthday',
    title: 'Mira turns 7',
    city: 'Bengaluru',
    guests: '40',
    budget: '60000',
    style: 'modern',
    diet: 'vegetarian',
    priorities: ['entertainment', 'decor'],
    notes: 'Space and planets theme. Kids aged 5–8, a few have nut allergies.',
    language: 'en',
    inDays: 24,
  },
  {
    eventType: 'festival',
    title: 'Green Valley Society Diwali Mela',
    city: 'Pune',
    guests: '450',
    budget: '350000',
    style: 'eco',
    diet: 'mixed',
    priorities: ['decor', 'entertainment'],
    notes:
      'Residents society event with food stalls and a kids’ rangoli contest. Want it plastic-free and quiet after 10 pm.',
    language: 'en',
    inDays: 60,
  },
];

function initialValues(today: string): FormValues {
  return {
    eventType: 'wedding',
    title: '',
    date: addDays(today, 90),
    city: '',
    guests: '150',
    budget: '800000',
    style: 'traditional',
    diet: 'vegetarian',
    priorities: [],
    notes: '',
    language: 'en',
  };
}

const toNumber = (value: string) => {
  const cleaned = value.replace(/[₹,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
};

/** Zod is only needed on submit, so it lives in its own chunk, prefetched when idle. */
const loadSchema = () => import('../../shared/schema.js');

const LOADING_STEPS = [
  'Balancing your budget',
  'Sequencing your timeline',
  'Shortlisting vendors',
  'Dreaming up your theme',
];

/** Maps server field paths (input.title) to form fields (title). */
const normaliseFieldKeys = (fields: Record<string, string>) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.replace(/^input\./, ''), v]));

export function PlannerForm() {
  const today = localToday();
  const [values, setValues] = useState<FormValues>(() => initialValues(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { dispatch } = usePlans();
  const announce = useAnnounce();
  const idPrefix = useId();
  const fid = (name: string) => `${idPrefix}-${name}`;

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(
      () => setLoadingStep((s) => (s + 1) % LOADING_STEPS.length),
      1600,
    );
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSchema(), 1_000);
    return () => window.clearTimeout(timer);
  }, []);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  const togglePriority = (category: PriorityCategory) => {
    set(
      'priorities',
      values.priorities.includes(category)
        ? values.priorities.filter((p) => p !== category)
        : [...values.priorities, category],
    );
  };

  const loadExample = () => {
    const { inDays, ...example } = EXAMPLES[exampleIndex % EXAMPLES.length]!;
    setValues({ ...example, date: addDays(today, inDays) });
    setErrors({});
    setFormError('');
    setExampleIndex((i) => i + 1);
    announce(`Example loaded: ${example.title}. Review the details and create the plan.`);
  };

  async function validate(): Promise<EventInput | null> {
    const { eventInputSchema, fieldErrors } = await loadSchema();
    const result = eventInputSchema.safeParse({
      ...values,
      guests: toNumber(values.guests),
      budget: toNumber(values.budget),
    });
    const next: Record<string, string> = result.success ? {} : fieldErrors(result.error);
    if (result.success) {
      const days = daysBetween(today, result.data.date);
      if (days < 0) next.date = 'Pick a date from today onwards.';
      else if (days > LIMITS.maxDaysAhead) next.date = 'Pick a date within the next 3 years.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return null;
    }
    return result.success ? result.data : null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const input = await validate();
    if (!input) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setLoadingStep(0);
    announce('Creating your plan. This takes a few seconds.');

    try {
      let plan;
      try {
        plan = (await requestPlan(input, today, controller.signal)).plan;
      } catch (error) {
        if (error instanceof ApiError && error.recoverable) {
          // Server or network down: the same engine runs right here in the browser.
          plan = (await import('../../shared/engine/planner.js')).buildPlan(input, { today });
        } else {
          throw error;
        }
      }
      const id = uid();
      dispatch({ type: 'plan/add', id, plan, at: new Date().toISOString() });
      announce(`Your plan for ${input.title} is ready.`);
      navigate({ name: 'plan', id, tab: 'overview' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof ApiError) {
        const fields = normaliseFieldKeys(error.fields);
        setErrors(fields);
        setFormError(error.message);
        if (Object.keys(fields).length > 0)
          window.requestAnimationFrame(() => summaryRef.current?.focus());
      } else {
        setFormError('Something unexpected happened. Please try again.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const errorEntries = Object.entries(errors);
  const budgetNumber = toNumber(values.budget);
  const guestsNumber = toNumber(values.guests);
  const budgetHint =
    Number.isFinite(budgetNumber) && budgetNumber > 0
      ? `${formatINRCompact(budgetNumber)}${Number.isFinite(guestsNumber) && guestsNumber > 0 ? ` · about ${formatINR(budgetNumber / guestsNumber)} per guest` : ''}`
      : 'Total you plan to spend, in rupees';

  const fieldProps = (name: keyof FormValues, hintId?: string) => ({
    id: fid(name),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby':
      [errors[name] ? fid(`${name}-error`) : '', hintId ?? ''].filter(Boolean).join(' ') ||
      undefined,
  });

  const fieldError = (name: string) =>
    errors[name] ? (
      <p className="error-text" id={fid(`${name}-error`)}>
        {errors[name]}
      </p>
    ) : null;

  return (
    <form
      className="card planner-form fade-in"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={fid('heading')}
      aria-busy={loading}
    >
      <div>
        <h2 id={fid('heading')}>Tell us about your celebration</h2>
        <p className="hint">Takes about a minute. Fields marked * are required.</p>
      </div>

      {(errorEntries.length > 0 || formError) && (
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={summaryRef}>
          <Icon name="alert" />
          <div>
            <strong>{formError || 'Please fix the following:'}</strong>
            {errorEntries.length > 0 && (
              <ul>
                {errorEntries.map(([name, message]) => (
                  <li key={name}>
                    <a
                      href={`#${fid(name)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(fid(name))?.focus();
                      }}
                    >
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <fieldset className="form-section">
        <legend className="legend">
          <span className="step-num" aria-hidden="true">
            1
          </span>{' '}
          What are we celebrating? *
        </legend>
        <div className="choice-grid" id={fid('eventType')}>
          {EVENT_TYPES.map((type) => (
            <label className="choice" key={type}>
              <input
                type="radio"
                name="eventType"
                value={type}
                checked={values.eventType === type}
                onChange={() => set('eventType', type)}
              />
              <span className="emoji" aria-hidden="true">
                {EVENT_TYPE_META[type].icon}
              </span>
              <span>
                <strong>{EVENT_TYPE_META[type].label}</strong>
                <small>{EVENT_TYPE_META[type].blurb}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="legend">
          <span className="step-num" aria-hidden="true">
            2
          </span>{' '}
          The essentials
        </legend>
        <div className="field">
          <label htmlFor={fid('title')}>Event name *</label>
          <input
            className="input"
            {...fieldProps('title')}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={LIMITS.titleMax}
            placeholder="e.g. Aarav & Diya’s Wedding"
            autoComplete="off"
            required
          />
          {fieldError('title')}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor={fid('date')}>Event date *</label>
            <input
              className="input"
              type="date"
              {...fieldProps('date')}
              value={values.date}
              min={today}
              max={addDays(today, LIMITS.maxDaysAhead)}
              onChange={(e) => set('date', e.target.value)}
              required
            />
            {fieldError('date')}
          </div>
          <div className="field">
            <label htmlFor={fid('city')}>City *</label>
            <input
              className="input"
              {...fieldProps('city')}
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
              list={fid('cities')}
              maxLength={LIMITS.cityMax}
              placeholder="e.g. Pune"
              autoComplete="address-level2"
              required
            />
            <datalist id={fid('cities')}>
              {POPULAR_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {fieldError('city')}
          </div>
          <div className="field">
            <label htmlFor={fid('guests')}>Number of guests *</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={LIMITS.minGuests}
              max={LIMITS.maxGuests}
              step={1}
              {...fieldProps('guests')}
              value={values.guests}
              onChange={(e) => set('guests', e.target.value)}
              required
            />
            {fieldError('guests')}
          </div>
          <div className="field">
            <label htmlFor={fid('budget')}>Total budget *</label>
            <div className="input-affix">
              <span aria-hidden="true">₹</span>
              <input
                className="input"
                inputMode="numeric"
                {...fieldProps('budget', fid('budget-hint'))}
                value={values.budget}
                onChange={(e) => set('budget', e.target.value)}
                required
              />
            </div>
            <p className="hint" id={fid('budget-hint')} aria-live="polite">
              {budgetHint}
            </p>
            {fieldError('budget')}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="legend">
          <span className="step-num" aria-hidden="true">
            3
          </span>{' '}
          Make it yours
        </legend>
        <fieldset className="field">
          <legend className="legend">Style</legend>
          <div className="chips">
            {STYLES.map((style) => (
              <label className="choice" key={style} title={STYLE_META[style].description}>
                <input
                  type="radio"
                  name="style"
                  value={style}
                  checked={values.style === style}
                  onChange={() => set('style', style)}
                />
                <strong>{STYLE_META[style].label}</strong>
              </label>
            ))}
          </div>
          <p className="hint">{STYLE_META[values.style].description}</p>
        </fieldset>

        <fieldset className="field" aria-describedby={fid('priorities-hint')}>
          <legend className="legend">What matters most? (up to {LIMITS.maxPriorities})</legend>
          <div className="chips">
            {PRIORITY_CATEGORIES.map((category) => {
              const checked = values.priorities.includes(category);
              return (
                <label className="choice" key={category}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && values.priorities.length >= LIMITS.maxPriorities}
                    onChange={() => togglePriority(category)}
                  />
                  <strong>{CATEGORY_META[category].label}</strong>
                </label>
              );
            })}
          </div>
          <p className="hint" id={fid('priorities-hint')}>
            Priorities get a bigger share of the budget.
          </p>
          {fieldError('priorities')}
        </fieldset>

        <div className="grid-2">
          <div className="field">
            <label htmlFor={fid('diet')}>Food preference</label>
            <select
              className="select"
              id={fid('diet')}
              value={values.diet}
              onChange={(e) => set('diet', e.target.value as Diet)}
            >
              {DIETS.map((d) => (
                <option key={d} value={d}>
                  {DIET_META[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={fid('language')}>Plan language</label>
            <select
              className="select"
              id={fid('language')}
              value={values.language}
              onChange={(e) => set('language', e.target.value as Language)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_META[l]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor={fid('notes')}>Anything else? (optional)</label>
          <textarea
            className="textarea"
            {...fieldProps('notes', fid('notes-count'))}
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            maxLength={LIMITS.notesMax}
            placeholder="Traditions, accessibility needs, themes you love, things to avoid…"
          />
          <p className="hint" id={fid('notes-count')}>
            {values.notes.length}/{LIMITS.notesMax} characters
          </p>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={loadExample} disabled={loading}>
          <Icon name="sparkles" /> Try an example
        </button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <span aria-hidden="true">{LOADING_STEPS[loadingStep]}…</span>
              <span className="sr-only">Creating your plan</span>
            </>
          ) : (
            <>
              <Icon name="sparkles" /> Create my plan
            </>
          )}
        </button>
      </div>
    </form>
  );
}
